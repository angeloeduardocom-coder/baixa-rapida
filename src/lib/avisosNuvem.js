// Avisos do app S.P.A Campo: só quando alguém SALVA algo (botão Salvar / Enviar / Pronto), nunca a
// cada tecla. Quem salva grava uma linha na tabela `avisos`; os outros celulares recebem pelo
// Realtime (bipe + mensagem) e, com o app fechado, pela notificação push (gatilho só nessa tabela).
// Linha: { app, perfis[] (quem recebe; vazio = todos do app), titulo, corpo, tag, autor, aparelho }.
import { supabase, meuAparelho } from './nuvem'
import { avisar } from './avisosAoVivo'
const idAparelho = () => meuAparelho // mesmo id da inscrição de push: quem salva não recebe o próprio aviso

export async function publicarAviso({ perfis = null, titulo, corpo = '', tag = '', autor = null, app = 'baixa' }) {
  if (!supabase) return false
  const { error } = await supabase.from('avisos').insert({ app, perfis, titulo, corpo, tag, url: '/', autor, aparelho: idAparelho() })
  if (error) console.error('Aviso não publicado:', error.message)
  return !error
}

// Só avisa quando o conteúdo mudou de verdade desde o último aviso deste assunto (tag) neste
// aparelho — salvar de novo sem mudar nada (teste, conferência) não notifica ninguém (28/10/2026).
const impressao = v => JSON.stringify(v ?? null, (k, x) => (/[fF]oto|_em$|Em$/.test(k) ? undefined : x))
const chaveUlt = tag => `aviso:ult:${tag}`
export function mudouDesdeUltimoAviso(tag, conteudo) {
  try { return localStorage.getItem(chaveUlt(tag)) !== impressao(conteudo) } catch { return true }
}
export function lembrarAviso(tag, conteudo) {
  try { localStorage.setItem(chaveUlt(tag), impressao(conteudo)) } catch { /* ok */ }
}

// Perfis que recebem o aviso de um tipo de campo (1, 2 ou 'pulv'); o Gestor recebe tudo.
export const perfisDoTipo = tipo => (tipo === 'pulv' ? ['pulv', 'gestor'] : tipo === 1 ? ['ferti1', 'gestor'] : tipo === 2 ? ['ferti2', 'gestor'] : ['ferti1', 'ferti2', 'pulv', 'gestor'])

export function ligarAvisos(perfil) {
  if (!supabase || !perfil) return () => {}
  const eu = idAparelho()
  const canal = supabase.channel(`avisos-campo-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'avisos', filter: 'app=eq.baixa' }, ({ new: a }) => {
      if (!a || a.aparelho === eu) return
      if (Array.isArray(a.perfis) && a.perfis.length && !a.perfis.includes(perfil.id)) return
      avisar({ titulo: a.titulo, corpo: a.corpo || '', tag: a.tag || '' })
    })
    .subscribe()
  return () => { supabase.removeChannel(canal) }
}
