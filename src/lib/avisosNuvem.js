// O que o app de Baixas avisa (bipe + mensagem) quando OUTRA pessoa muda algo, por perfil:
//  • Baixa lançada (Ferti do perfil / Pulverização) por outro celular ou pelo sistema;
//  • Transferência nova (do campo do perfil);
//  • Adubação da semana LIBERADA (Ferti);
//  • Programação de pulverização nova ou alterada (Pulverização).
// As mesmas regras (e as mesmas "tags") estão na função enviar-push do Supabase, que manda a
// notificação com o app fechado — a tag igual evita aviso duplicado.
import { supabase, meuAparelho } from './nuvem'
import { avisar } from './avisosAoVivo'
import { transfVisivel } from './sessao'

const dm = d => (d ? String(d).split('-').reverse().slice(0, 2).join('/') : '')
const assinatura = v => JSON.stringify(v ?? null)

export function ligarAvisos(perfil, nome) {
  if (!supabase || !perfil) return () => {}
  const temFerti = n => perfil.tipos.includes(n)
  const temPulv = perfil.tipos.includes('pulv')
  const fotos = { baixas: new Map(), transf: new Map(), adub: new Map(), pulv: new Map() }

  // Fotografia inicial (pra saber o que é novo quando chegar o evento).
  const guardarBaixas = (chave, lista) => fotos.baixas.set(chave, new Map((lista || []).map(i => [i.id, assinatura(i)])))
  async function carregar() {
    for (const n of [1, 2]) if (temFerti(n)) {
      const { data } = await supabase.from('adubacao_baixa_diaria').select('baixa').eq('ferti', n).maybeSingle()
      guardarBaixas(`f${n}`, data?.baixa)
    }
    if (temPulv) {
      const { data } = await supabase.from('pulverizacao_baixa_diaria').select('baixa').eq('id', 1).maybeSingle()
      guardarBaixas('pulv', data?.baixa)
      const desde = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
      const { data: apl } = await supabase.from('aplicacoes').select('id, programas').gte('data', desde)
      for (const a of apl || []) fotos.pulv.set(a.id, assinatura(a.programas))
    }
    const { data: tr } = await supabase.from('adubacao_transferencias').select('dados').eq('id', 1).maybeSingle()
    for (const t of tr?.dados?.lista || []) fotos.transf.set(t.id, t.produto || '')
    if (temFerti(1) || temFerti(2)) {
      const { data: ad } = await supabase.from('adubacao_programacoes').select('id, status').eq('arquivado', false).limit(50)
      for (const a of ad || []) fotos.adub.set(a.id, a.status)
    }
  }
  carregar().catch(() => {})

  function baixasMudaram(chave, rotulo, lista) {
    const antes = fotos.baixas.get(chave) || new Map()
    const grupos = new Map()
    for (const i of lista || []) {
      if (antes.get(i.id) === assinatura(i)) continue
      if (i.aparelho && i.aparelho === meuAparelho) continue
      const k = `${i.data}|${i.aparelho || 'sistema'}`
      grupos.set(k, [...(grupos.get(k) || []), i])
    }
    guardarBaixas(chave, lista)
    for (const [k, itens] of grupos) {
      const [data, aparelho] = k.split('|')
      avisar({ titulo: `Baixa lançada — ${rotulo}`, corpo: `${itens[0].autor || 'Alguém'} lançou ${itens.length} item(ns) em ${dm(data)}`, tag: `baixa:${chave}:${data}:${aparelho}` })
    }
  }
  async function listaDoEvento(payload, tabela, filtro) {
    if (payload.new?.baixa !== undefined) return payload.new.baixa
    const { data } = await supabase.from(tabela).select('baixa').match(filtro).maybeSingle()
    return data?.baixa
  }

  const canal = supabase.channel(`avisos-baixa-${Math.random().toString(36).slice(2)}`)
  canal.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'adubacao_baixa_diaria' }, async payload => {
    const n = payload.new?.ferti
    if (!temFerti(n)) return
    baixasMudaram(`f${n}`, `Ferti ${n}`, await listaDoEvento(payload, 'adubacao_baixa_diaria', { ferti: n }))
  })
  if (temPulv) {
    canal.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pulverizacao_baixa_diaria' }, async payload => {
      baixasMudaram('pulv', 'Pulverização', await listaDoEvento(payload, 'pulverizacao_baixa_diaria', { id: 1 }))
    })
    canal.on('postgres_changes', { event: '*', schema: 'public', table: 'aplicacoes' }, payload => {
      const r = payload.new
      if (!r || r.arquivado) return
      const sig = r.programas === undefined ? null : assinatura(r.programas)
      const antes = fotos.pulv.get(r.id)
      if (sig !== null) fotos.pulv.set(r.id, sig)
      if (payload.eventType === 'INSERT') avisar({ titulo: 'Nova programação de pulverização', corpo: `Para ${dm(r.data)}`, tag: `pulvprog:${r.id}` })
      else if (sig !== null && antes !== undefined && antes !== sig) avisar({ titulo: 'Programação de pulverização alterada', corpo: `Dia ${dm(r.data)}`, tag: `pulvprog:${r.id}` })
    })
  }
  canal.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'adubacao_transferencias' }, payload => {
    const lista = payload.new?.dados?.lista
    if (!Array.isArray(lista)) return
    for (const t of lista) {
      const antes = fotos.transf.get(t.id)
      fotos.transf.set(t.id, t.produto || '')
      if (!t.produto || antes) continue // só avisa quando o produto aparece pela 1ª vez
      if (!transfVisivel(t, perfil) || (t.autor && t.autor === nome)) continue
      avisar({ titulo: 'Nova transferência de insumo', corpo: `${t.produto}${t.autor ? ` · ${t.autor}` : ''}`, tag: `transf:${t.id}` })
    }
  })
  if (temFerti(1) || temFerti(2)) {
    canal.on('postgres_changes', { event: '*', schema: 'public', table: 'adubacao_programacoes' }, payload => {
      const r = payload.new
      if (!r || r.arquivado || r.status === undefined) return
      const antes = fotos.adub.get(r.id)
      fotos.adub.set(r.id, r.status)
      if (r.status === 'liberado' && antes !== 'liberado') avisar({ titulo: 'Adubação liberada', corpo: `Semana ${r.data || ''} — programação pronta`, tag: `adub:${r.id}:liberado` })
    })
  }
  canal.subscribe()
  return () => { supabase.removeChannel(canal) }
}
