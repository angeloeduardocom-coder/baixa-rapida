// Ligação com o banco do sistema (Supabase do SPA). Sem as variáveis de ambiente o app continua
// funcionando só no aparelho, como antes.
//
// - Baixa Ferti 1 / Ferti 2 → `adubacao_baixa_diaria` (a mesma "Baixa do dia" da tela do
//   Irrigante no sistema), campo `baixa`, uma lista por Ferti com itens { id, data, produto,
//   quantidade, unidade, transferencia, local, origem }.
// - Baixa Pulverização → `pulverizacao_baixa_diaria` (linha id 1, mesmo formato).
// - Transferências → `adubacao_transferencias` (linha id 1, dados.lista), a mesma do sistema.
// - Fotos → Storage, bucket público `fotos-insumos`; o endereço vai no item (fotoTransfUrl).
import { createClient } from '@supabase/supabase-js'

// Valores do Vercel limpos (espaço, quebra de linha, aspas) e, se a URL vier sem "https://",
// completa. Se mesmo assim estiver errado, o app NÃO trava: segue só no aparelho e avisa.
const limpar = v => String(v || '').trim().replace(/^["']|["']$/g, '').trim()
let URL_NUVEM = limpar(import.meta.env.VITE_SUPABASE_URL).replace(/\/+$/, '')
if (URL_NUVEM && !/^https?:\/\//i.test(URL_NUVEM)) URL_NUVEM = `https://${URL_NUVEM}`
const CHAVE_NUVEM = limpar(import.meta.env.VITE_SUPABASE_ANON_KEY).replace(/\s+/g, '')
export let erroNuvem = ''
function criarCliente() {
  if (!URL_NUVEM || !CHAVE_NUVEM) return null
  try {
    return createClient(URL_NUVEM, CHAVE_NUVEM)
  } catch (e) {
    erroNuvem = `Configuração da nuvem inválida (${e?.message || e}). O app segue salvando só no aparelho.`
    console.error(erroNuvem)
    return null
  }
}
export const supabase = criarCliente()
export const nuvemLigada = !!supabase
const BUCKET = 'fotos-insumos'

function tabela(tipo) {
  return tipo === 'pulv'
    ? { nome: 'pulverizacao_baixa_diaria', coluna: 'id', valor: 1 }
    : { nome: 'adubacao_baixa_diaria', coluna: 'ferti', valor: Number(tipo) }
}

const numero = v => {
  let t = String(v ?? '').trim()
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.') // 1.250,5 → 1250.5
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
export const quantTexto = q => (q === null || q === undefined ? '' : String(q).replace('.', ','))

// Linha do app ⇄ item do sistema.
export const paraServidor = (l, data) => ({ id: l.id, data, produto: l.produto, quantidade: numero(l.quant), unidade: l.unidade || null, transferencia: l.transferencia ?? null, local: l.local ?? null, origem: l.origem || 'app' })
// Sem unidade (lançado na tela do sistema): pega a do cadastro de produtos do app.
export const paraApp = (i, catalogo = []) => ({ id: i.id, produto: i.produto || '', unidade: i.unidade || catalogo.find(p => p.nome.toUpperCase() === String(i.produto || '').toUpperCase())?.unidade || 'L', quant: quantTexto(i.quantidade), origem: i.origem || 'sistema', transferencia: i.transferencia ?? null, local: i.local ?? null })

async function lerLista(tipo) {
  const t = tabela(tipo)
  const { data, error } = await supabase.from(t.nome).select('baixa').eq(t.coluna, t.valor).single()
  if (error) throw error
  return Array.isArray(data?.baixa) ? data.baixa : []
}

// Itens de uma Ferti/Pulverização (todas as datas) — pro Histórico e pra abrir um dia.
export async function lerBaixasNuvem(tipo) {
  if (!supabase) return []
  return lerLista(tipo)
}

// Grava a baixa de um dia: troca os itens daquele dia pelos do app. Itens que outra pessoa
// lançou no mesmo dia (no sistema ou em outro celular) e que este aparelho ainda não conhecia
// são mantidos e devolvidos, pra entrarem na tela. `conhecidos` = ids que este aparelho já viu
// naquele dia (o que saiu da lista aqui foi apagado de propósito).
export async function enviarBaixaNuvem(data, tipo, linhas, conhecidos = []) {
  if (!supabase) throw new Error('sem nuvem')
  const t = tabela(tipo)
  const atual = await lerLista(tipo)
  const meus = new Set(linhas.map(l => l.id))
  const vistos = new Set(conhecidos)
  const novosDeFora = atual.filter(i => i.data === data && !meus.has(i.id) && !vistos.has(i.id))
  const lista = [...atual.filter(i => i.data !== data), ...novosDeFora, ...linhas.map(l => paraServidor(l, data))]
  const { error } = await supabase.from(t.nome).update({ baixa: lista, atualizado_em: new Date().toISOString() }).eq(t.coluna, t.valor)
  if (error) throw error
  return novosDeFora
}

// ---------- Transferências ----------
export async function lerTransferenciasNuvem() {
  if (!supabase) return []
  const { data, error } = await supabase.from('adubacao_transferencias').select('dados').eq('id', 1).single()
  if (error) throw error
  return Array.isArray(data?.dados?.lista) ? data.dados.lista : []
}

// Junta a lista da nuvem com a deste aparelho (a deste aparelho vale para os itens dele; os
// apagados aqui saem) e grava. Devolve a lista completa, pra tela mostrar os de outros celulares.
export async function sincronizarTransferencias(local, apagados = []) {
  if (!supabase) throw new Error('sem nuvem')
  const remota = await lerTransferenciasNuvem()
  const idsLocais = new Set(local.map(t => t.id))
  const fora = new Set(apagados)
  const junta = [...remota.filter(r => !idsLocais.has(r.id) && !fora.has(r.id)), ...local.filter(t => !fora.has(t.id))]
  const { error } = await supabase.from('adubacao_transferencias').update({ dados: { lista: junta }, atualizado_em: new Date().toISOString() }).eq('id', 1)
  if (error) throw error
  return junta
}

// ---------- Fotos ----------
export async function enviarFoto(idItem, dataUrl) {
  if (!supabase) throw new Error('sem nuvem')
  const blob = await (await fetch(dataUrl)).blob()
  const caminho = `transferencias/${idItem}-${Date.now()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(caminho, blob, { contentType: 'image/jpeg', upsert: true })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl
}

// Baixa uma foto da nuvem como dataURL (pra carimbar, mandar no WhatsApp e pôr no PDF).
export async function baixarFoto(url) {
  const blob = await (await fetch(url)).blob()
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}
