// Avisos ao vivo dos apps (Dormex, Baixa): bipe + vibração + mensagem na tela quando outra
// pessoa muda algo, e notificação push do celular (mesmo com o app fechado) quando ativada.
// Arquivo igual no sistema SPA (src/lib/avisosAoVivo.js) — só muda o import do supabase.
import { supabase, meuAparelho } from './nuvem'

// Chave PÚBLICA do push (a privada fica só no Supabase, nos segredos da função enviar-push).
export const CHAVE_PUBLICA_PUSH = 'BCxMZa4tQ_aflTm3s6cP9HNCPyBiOZSVIFRHXY1CHFq7Rm4aywP-UI6dfRmbEB45vAILGrCXAJfXK9OqK5c9K9Y'

const CHAVE_LISTA = 'avisos:lista'
const CHAVE_SOM = 'avisos:som'
const CHAVE_APARELHO = 'avisos:aparelho'

export function idAparelho() {
  try {
    let id = localStorage.getItem(CHAVE_APARELHO)
    if (!id) { id = (crypto.randomUUID?.() || String(Math.random()).slice(2)); localStorage.setItem(CHAVE_APARELHO, id) }
    return id
  } catch { return 'sem-id' }
}

// ── Som ──
let ctx = null
export function destravarSom() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
  } catch { /* sem áudio */ }
}
export const somLigado = () => { try { return localStorage.getItem(CHAVE_SOM) !== '0' } catch { return true } }
export function definirSom(ligado) { try { localStorage.setItem(CHAVE_SOM, ligado ? '1' : '0') } catch { /* ok */ } }
export function tocarBipe() {
  try { navigator.vibrate?.([200, 100, 200]) } catch { /* ok */ }
  if (!somLigado()) return
  try {
    destravarSom()
    if (!ctx) return
    const agora = ctx.currentTime
    ;[0, 0.22].forEach((t, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.type = 'sine'; o.frequency.value = i ? 1046 : 880
      g.gain.setValueAtTime(0.0001, agora + t)
      g.gain.exponentialRampToValueAtTime(0.35, agora + t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, agora + t + 0.18)
      o.connect(g).connect(ctx.destination)
      o.start(agora + t); o.stop(agora + t + 0.2)
    })
  } catch { /* ok */ }
}

// ── Lista de avisos ──
export function lerAvisos() { try { return JSON.parse(localStorage.getItem(CHAVE_LISTA) || '[]') } catch { return [] } }
const tagsRecentes = new Map() // tag → quando avisou (evita bipe repetido do mesmo assunto)
const minhasTags = new Map() // tag → quando ESTE aparelho mexeu (não avisa a si mesmo)
export function marcarMinhaAlteracao(tag) { minhasTags.set(tag, Date.now()) }

// { titulo, corpo, tag } — tag igual em menos de 2 min só atualiza a lista, sem bipe de novo.
export function avisar({ titulo, corpo = '', tag = '' }) {
  const agora = Date.now()
  if (tag && minhasTags.has(tag) && agora - minhasTags.get(tag) < 30000) return
  const repetido = tag && tagsRecentes.has(tag) && agora - tagsRecentes.get(tag) < 120000
  if (tag) tagsRecentes.set(tag, agora)
  const lista = lerAvisos().filter(a => !(tag && a.tag === tag && repetido))
  const novo = { id: agora + Math.random(), titulo, corpo, tag, em: new Date().toISOString(), lido: false }
  try { localStorage.setItem(CHAVE_LISTA, JSON.stringify([novo, ...lista].slice(0, 30))) } catch { /* ok */ }
  window.dispatchEvent(new CustomEvent('avisos:novo', { detail: { ...novo, silencioso: repetido } }))
  if (repetido) return
  tocarBipe()
  // App minimizado (ainda vivo): notificação do celular.
  if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
    navigator.serviceWorker?.ready.then(reg => reg.showNotification(titulo, { body: corpo, tag: tag || undefined, icon: '/icon-192.png', vibrate: [200, 100, 200] })).catch(() => {})
  }
}
export function marcarTodosLidos() {
  try { localStorage.setItem(CHAVE_LISTA, JSON.stringify(lerAvisos().map(a => ({ ...a, lido: true })))) } catch { /* ok */ }
  window.dispatchEvent(new CustomEvent('avisos:novo', { detail: null }))
}

// Push que chegou com o app aberto (o service worker manda pra cá em vez de notificar).
if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.tipo === 'push-recebido') avisar({ titulo: e.data.titulo, corpo: e.data.corpo, tag: e.data.tag })
  })
}

// ── Push (servidor → celular) ──
const base64ParaUint8 = b64 => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const bin = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, c => c.charCodeAt(0))
}
export function suportaPush() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}
export async function estadoPush() {
  if (!suportaPush()) return 'sem-suporte'
  if (Notification.permission === 'denied') return 'bloqueado'
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return sub ? 'ativo' : 'inativo'
  } catch { return 'inativo' }
}
// Pede permissão, inscreve este celular e guarda no banco (tabela push_inscricoes).
export async function ativarPush({ app, perfil = null, nome = null }) {
  if (!suportaPush()) throw new Error('Este navegador não aceita notificação. No iPhone, instale o app na tela inicial primeiro.')
  destravarSom()
  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') throw new Error('Notificação não permitida. Libere nas configurações do navegador pra este site.')
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ParaUint8(CHAVE_PUBLICA_PUSH) })
  const json = sub.toJSON()
  if (!supabase) throw new Error('Sem conexão com o servidor.')
  const { error } = await supabase.from('push_inscricoes').upsert({
    endpoint: json.endpoint, inscricao: json, app, perfil, nome, aparelho: meuAparelho, atualizado_em: new Date().toISOString(), /* mesmo id das baixas: quem lançou não recebe o próprio aviso */
  })
  if (error) throw new Error('Não consegui registrar no servidor. A tabela push_inscricoes foi criada no Supabase?')
  return true
}
