import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Send, Copy, Check, X, ClipboardList, ArrowRightLeft, Camera, CalendarDays, FileDown, Pencil, Trash2 } from 'lucide-react'
import { hojeISO, dataBR, diaMes } from '../lib/useLocal'
import { lerFotosLocais, carimbarFoto } from '../lib/fotos'
import { tituloBaixa, textoBaixa, textoTransferencias, abrirWhatsapp } from '../lib/textos'
import { valoresDaLinha } from '../lib/imagemTabela'
import { gerarPdfRelatorio } from '../lib/pdfRelatorio'
import { PRODUTOS } from '../data/produtos'
import { transfVisivel } from '../lib/sessao'
import RequisicaoPulverizacao from './RequisicaoPulverizacao'
import { nuvemLigada, lerDiasComProgramacao, lerBaixasNuvem, moverBaixaNuvem, apagarItemNuvem, lerTransferenciasNuvem, baixarFoto, paraApp } from '../lib/nuvem'
import { baixarArquivo } from '../lib/textos'
import { gerarExcelBaixa } from '../lib/excelBaixa'

// Histórico / relatório: tudo o que foi lançado NESTE aparelho num dia — as baixas (Ferti 1,
// Ferti 2, Pulverização) e as transferências, com as fotos tiradas. Dá pra mandar o resumão
// completo (texto + fotos) no WhatsApp.

const TIPOS = [[1, 'Ferti 1'], [2, 'Ferti 2'], ['pulv', 'Pulverização']]
const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

function ler(chave, padrao) {
  try { const raw = localStorage.getItem(chave); return raw ? JSON.parse(raw) : padrao } catch { return padrao }
}

function VisorFoto({ src, onFechar }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-2" onClick={onFechar}>
      <img src={src} alt="Foto" className="max-w-full max-h-full object-contain" />
      <button className="absolute top-3 right-3 bg-white/15 text-white rounded-full p-2"><X size={20} /></button>
    </div>
  )
}

export default function Historico({ perfil, nome }) {
  // Perfil Pulverização: histórico = baixa de Pulverização + a requisição de cada dia (sem transferências).
  const soPulv = perfil?.id === 'pulv'
  const [diasProgramacao, setDiasProgramacao] = useState([])
  useEffect(() => { if (soPulv) lerDiasComProgramacao().then(setDiasProgramacao).catch(() => {}) }, [soPulv])
  const tiposPerfil = perfil?.tipos || [1, 2, 'pulv']
  const tipoOk = t => tiposPerfil.includes(t === 'pulv' ? 'pulv' : Number(t))
  const [porDia, setPorDia] = useState(() => ler('baixa:porDia', {}))
  // Transferência adicionada e deixada em branco (sem produto e sem nenhum campo) não entra.
  const preenchida = t => ['produto', 'saldoAnt', 'qtdeProgramada', 'qtdeTransf', 'estoque', 'destino', 'devolucao'].some(c => String(t[c] ?? '').trim())
  const [transfs, setTransfs] = useState(() => ler('transf:lista', []).filter(preenchida))

  // Com a nuvem ligada, o relatório mostra também o que foi lançado em outros celulares (e na
  // tela do sistema). O que está neste aparelho vale primeiro.
  useEffect(() => {
    if (!nuvemLigada) return
    let ativo = true
    Promise.all([1, 2, 'pulv'].map(t => lerBaixasNuvem(t).then(itens => [t, itens]).catch(() => [t, []]))).then(res => {
      if (!ativo) return
      setPorDia(local => {
        const novo = { ...local }
        for (const [t, itens] of res) {
          const grupos = {}
          for (const i of itens) if (i.data) (grupos[`${i.data}|${t}`] ||= []).push(paraApp(i, PRODUTOS))
          // Junta: o que está neste aparelho + o que outras pessoas lançaram no mesmo dia.
          for (const [k, ls] of Object.entries(grupos)) {
            const ids = new Set((novo[k] || []).map(l => l.id))
            novo[k] = [...(novo[k] || []), ...ls.filter(l => !ids.has(l.id))]
          }
        }
        return novo
      })
    })
    lerTransferenciasNuvem().then(remota => {
      if (!ativo) return
      setTransfs(local => { const ids = new Set(local.map(t => t.id)); return [...local, ...remota.filter(r => !ids.has(r.id) && preenchida(r))] })
    }).catch(() => {})
    return () => { ativo = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [fotos, setFotos] = useState({})
  const [foto, setFoto] = useState(null)
  const [copiado, setCopiado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [gerandoPdf, setGerandoPdf] = useState(false)
  useEffect(() => { lerFotosLocais().then(setFotos).catch(() => {}) }, [])

  // Dias que têm alguma coisa (baixa com produto ou transferência), mais novo primeiro.
  const dias = useMemo(() => {
    const s = new Set()
    for (const [chave, linhas] of Object.entries(porDia)) if ((linhas || []).length && tipoOk(chave.split('|')[1])) s.add(chave.split('|')[0])
    if (!soPulv) for (const t of transfs) if (t.data && transfVisivel(t, perfil)) s.add(t.data)
    if (soPulv) for (const x of diasProgramacao) if (x <= hojeISO()) s.add(x)
    return [...s].sort().reverse()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [porDia, transfs, diasProgramacao])

  const [dia, setDia] = useState(hojeISO)
  const idx = dias.indexOf(dia)


  // Corrigir a data de uma baixa lançada no dia errado: passa tudo dela pro dia certo (aqui e na nuvem).
  const [movendo, setMovendo] = useState(null) // { id, nova }
  const [erroMover, setErroMover] = useState('')
  async function moverBaixa(tipo, para) {
    const de = dia
    if (!para || para === de) { setMovendo(null); return }
    if (!window.confirm(`Passar esta baixa de ${dataBR(de)} para ${dataBR(para)}?`)) return
    const kDe = `${de}|${tipo}`, kPara = `${para}|${tipo}`
    const ids = (porDia[kDe] || []).map(l => l.id)
    try {
      if (nuvemLigada) await moverBaixaNuvem(tipo, de, para, ids)
      const mexer = (chave, fn) => { try { const v = ler(chave, null); if (v) localStorage.setItem(chave, JSON.stringify(fn(v))) } catch { /* segue */ } }
      mexer('baixa:porDia', v => { const { [kDe]: a = [], ...r } = v; return a.length ? { ...r, [kPara]: [...(r[kPara] || []), ...a] } : v })
      mexer('baixa:salvos', v => { const { [kDe]: a, ...r } = v; return a ? { ...r, [kPara]: r[kPara] || a } : v })
      mexer('baixa:enviados', v => { const { [kDe]: a, ...r } = v; return a ? { ...r, [kPara]: [...new Set([...(r[kPara] || []), ...a])] } : v })
      mexer('baixa:filaNuvem', v => v.map(x => (x === kDe ? kPara : x)))
      setPorDia(p => { const { [kDe]: a = [], ...r } = p; return { ...r, [kPara]: [...(r[kPara] || []), ...a] } })
      setMovendo(null); setErroMover(''); setDia(para)
    } catch (e) { setErroMover(`Não consegui mudar a data agora (${e?.message || 'sem internet'}). Tente de novo com internet.`) }
  }


  // Tira UM produto da baixa (ex.: repetido) — aqui no aparelho e na nuvem.
  async function apagarItem(tipo, l) {
    if (!window.confirm(`Apagar ${l.produto} desta baixa?`)) return
    const k = `${dia}|${tipo}`
    try {
      if (nuvemLigada) await apagarItemNuvem(tipo, l.id)
      for (const chave of ['baixa:porDia']) { const v = ler(chave, null); if (v?.[k]) localStorage.setItem(chave, JSON.stringify({ ...v, [k]: v[k].filter(x => x.id !== l.id) })) }
      const sv = ler('baixa:salvos', null)
      if (sv?.[k]) localStorage.setItem('baixa:salvos', JSON.stringify({ ...sv, [k]: { ...sv[k], linhas: (sv[k].linhas || []).filter(x => x.id !== l.id) } }))
      setPorDia(p => ({ ...p, [k]: (p[k] || []).filter(x => x.id !== l.id) }))
    } catch (e) { setErroMover(`Não consegui apagar agora (${e?.message || 'sem internet'}).`) }
  }

  const baixas = TIPOS.filter(([id]) => tipoOk(id)).map(([id, rotulo]) => ({ id, rotulo, linhas: porDia[`${dia}|${id}`] || [] })).filter(b => b.linhas.length)
  const transfDoDia = soPulv ? [] : transfs.filter(t => t.data === dia && transfVisivel(t, perfil))
  // Fotos que estão só na nuvem (tiradas em outro celular): baixa as do dia aberto.
  useEffect(() => {
    for (const t of transfDoDia) {
      const k = `${t.id}:fotoTransf`
      if (t.fotoTransfUrl && !fotos[k]) baixarFoto(t.fotoTransfUrl).then(src => setFotos(f => (f[k] ? f : { ...f, [k]: src }))).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dia, transfs])
  const fotosDoDia = transfDoDia.filter(t => fotos[`${t.id}:fotoTransf`])
  const totalProdutos = baixas.reduce((n, b) => n + b.linhas.length, 0)
  const temRequisicao = soPulv && diasProgramacao.includes(dia)
  const vazio = baixas.length === 0 && transfDoDia.length === 0 && !temRequisicao

  const textoCompleto = useMemo(() => {
    const partes = [`*RELATÓRIO DO DIA ${dataBR(dia)}*`]
    for (const b of baixas) partes.push(textoBaixa(b.id, dia, b.linhas))
    if (transfDoDia.length) partes.push(textoTransferencias(dia, transfDoDia.map(t => ({ ...t, temFotoTransf: !!fotos[`${t.id}:fotoTransf`] }))))
    return partes.join('\n\n')
  }, [baixas, transfDoDia, dia, fotos])

  // Os arquivos (Excel + fotos) ficam prontos ANTES do toque em Enviar: o celular só deixa abrir a
  // folha de compartilhar logo depois do toque — se gerar o Excel na hora, ele recusa e cai no texto.
  const [prontos, setProntos] = useState({ chave: '', arqs: [] })
  const [msgEnvio, setMsgEnvio] = useState('')
  const chaveArqs = `${dia}|${JSON.stringify(baixas.map(b => [b.id, b.linhas.map(l => [l.produto, l.quant])]))}|${fotosDoDia.map(t => t.id).join(',')}`
  async function gerarArquivos() {
    const arqs = []
    for (const b of baixas) {
      const blob = await gerarExcelBaixa(tituloBaixa(b.id, dia), b.linhas, dia)
      arqs.push(new File([blob], `BAIXAS ${b.id === 'pulv' ? 'PULVERIZACAO' : `FERTI ${b.id}`} ${dia.slice(8, 10)}-${dia.slice(5, 7)}.xlsx`, { type: blob.type }))
    }
    for (let i = 0; i < fotosDoDia.length; i++) {
      const t = fotosDoDia[i]
      const nome = (t.produto || `PRODUTO ${i + 1}`).toUpperCase()
      const blob = await carimbarFoto(fotos[`${t.id}:fotoTransf`], `${nome} — TRANSFERÊNCIA · ${diaMes(dia)}`)
      arqs.push(new File([blob], `${i + 1}_${nome.replace(/[^\w-]+/g, '_')}.jpg`, { type: 'image/jpeg' }))
    }
    return arqs
  }
  useEffect(() => {
    if (!baixas.length && !fotosDoDia.length) return
    let ativo = true
    gerarArquivos().then(arqs => { if (ativo) setProntos({ chave: chaveArqs, arqs }) }).catch(() => {})
    return () => { ativo = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveArqs])

  // O Chrome do Android não deixa um site anexar .xlsx direto no WhatsApp (só foto/PDF/texto). Então:
  // o Excel é SALVO no celular (Downloads, "BAIXAS FERTI 1 29-10.xlsx") e o WhatsApp abre com o texto;
  // no WhatsApp: 📎 → Documento → o arquivo aparece no topo. No PC é igual (WhatsApp Web).
  async function enviar() {
    if (vazio || enviando) return
    setEnviando(true); setMsgEnvio('')
    try {
      const arqs = prontos.chave === chaveArqs ? prontos.arqs : await gerarArquivos()
      const excels = arqs.filter(a => a.name.endsWith('.xlsx'))
      for (const a of excels) baixarArquivo(a, a.name)
      if (excels.length) setMsgEnvio(`Excel salvo no celular (${excels.map(a => a.name).join(', ')}). No WhatsApp toque no 📎 → Documento e escolha o arquivo.`)
      const fotosArq = arqs.filter(a => a.type === 'image/jpeg')
      if (fotosArq.length && navigator.canShare?.({ files: fotosArq })) {
        try { await navigator.share({ files: fotosArq, text: textoCompleto }); return }
        catch (e) { if (e?.name === 'AbortError') return }
      }
      await abrirWhatsapp(textoCompleto)
    } catch (e) {
      setMsgEnvio(`Erro ao preparar (${e?.name || ''} ${e?.message || ''}).`)
    } finally { setEnviando(false) }
  }
  async function gerarPdf() {
    if (vazio || gerandoPdf) return
    setGerandoPdf(true)
    try {
      const blob = await gerarPdfRelatorio({ dia, baixas, transferencias: transfDoDia, fotos })
      const nome = `relatorio_${dia}.pdf`
      const arq = new File([blob], nome, { type: 'application/pdf' })
      // Celular: abre o menu de compartilhar/salvar; computador: baixa o arquivo.
      if (navigator.canShare?.({ files: [arq] })) {
        try { await navigator.share({ files: [arq] }); return } catch (e) { if (e?.name === 'AbortError') return }
      }
      baixarArquivo(blob, nome)
    } catch (e) {
      alert(`Não consegui gerar o PDF: ${e.message}`)
    } finally { setGerandoPdf(false) }
  }

  function copiar() {
    navigator.clipboard?.writeText(textoCompleto).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1800) })
  }

  const d = new Date(`${dia}T12:00:00`)

  return (
    <div className="space-y-4">
      {/* Escolha do dia */}
      <div className="bg-white rounded-2xl border border-gray-200 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <button onClick={() => idx < dias.length - 1 && setDia(dias[idx + 1])} disabled={idx < 0 || idx >= dias.length - 1} className="p-2.5 rounded-xl border border-gray-200 disabled:opacity-30" aria-label="Dia anterior"><ChevronLeft size={20} /></button>
          <div className="flex-1 text-center">
            <p className="font-bold text-lg text-gray-800">{dataBR(dia)}</p>
            <p className="text-xs text-gray-400 capitalize">{SEMANA[d.getDay()]}{dia === hojeISO() ? ' · hoje' : ''}</p>
          </div>
          <button onClick={() => idx > 0 && setDia(dias[idx - 1])} disabled={idx <= 0} className="p-2.5 rounded-xl border border-gray-200 disabled:opacity-30" aria-label="Próximo dia"><ChevronRight size={20} /></button>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-500">
          <CalendarDays size={16} />
          <input type="date" value={dia} onChange={e => e.target.value && setDia(e.target.value)} className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-base text-green-700 font-semibold" />
        </label>
        {dias.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {dias.slice(0, 15).map(x => (
              <button key={x} onClick={() => setDia(x)} className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold border ${x === dia ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-600'}`}>{diaMes(x)}</button>
            ))}
          </div>
        )}
      </div>

      {vazio ? (
        <p className="text-center text-gray-400 py-10">Nada lançado neste aparelho em {dataBR(dia)}.</p>
      ) : (
        <>
          {/* Resumo */}
          {!soPulv && <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center"><ClipboardList size={18} className="mx-auto text-green-600" /><p className="text-2xl font-bold text-gray-800">{totalProdutos}</p><p className="text-xs text-gray-500">produtos na baixa</p></div>
            <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center"><ArrowRightLeft size={18} className="mx-auto text-blue-600" /><p className="text-2xl font-bold text-gray-800">{transfDoDia.length}</p><p className="text-xs text-gray-500">transferências</p></div>
            <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center"><Camera size={18} className="mx-auto text-amber-600" /><p className="text-2xl font-bold text-gray-800">{fotosDoDia.length}</p><p className="text-xs text-gray-500">fotos</p></div>
          </div>}

          {/* Baixas */}
          {baixas.map(b => (
            <div key={b.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="bg-green-700 text-white text-sm font-bold px-3 py-2 flex items-start gap-2">
                <p className="flex-1">{tituloBaixa(b.id, dia)}{(() => { const q = [...new Set(b.linhas.map(l => l.autor || nome).filter(Boolean))]; return q.length ? <span className="font-normal text-green-100"> · lançada por {q.join(', ')}</span> : null })()}</p>
                <button onClick={() => { setErroMover(''); setMovendo(movendo?.id === b.id ? null : { id: b.id, nova: dia }) }} className="shrink-0 flex items-center gap-1 text-xs font-bold bg-white/20 rounded-lg px-2 py-1"><Pencil size={12} /> Mudar data</button>
              </div>
              {movendo?.id === b.id && (
                <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 space-y-1.5">
                  <p className="text-xs font-semibold text-amber-800">Lançou no dia errado? Escolha o dia certo:</p>
                  <div className="flex gap-2">
                    <input type="date" value={movendo.nova} onChange={e => setMovendo(m => ({ ...m, nova: e.target.value }))} className="flex-1 border border-gray-300 rounded-xl px-3 py-2 bg-white font-semibold text-green-700" />
                    <button onClick={() => moverBaixa(b.id, movendo.nova)} className="px-4 rounded-xl bg-green-600 text-white font-bold">Mover</button>
                  </div>
                  {erroMover && <p className="text-xs text-red-600">{erroMover}</p>}
                </div>
              )}
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 text-xs text-gray-500 uppercase"><th className="text-left px-3 py-1.5">Produto</th><th className="text-right px-3 py-1.5">Quantidade</th><th className="w-8" /></tr></thead>
                <tbody>
                  {b.linhas.map(l => {
                    const [produto, qtd, un] = valoresDaLinha(l)
                    return (
                      <tr key={l.id} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-semibold text-gray-800">{produto}</td>
                        <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{qtd || '—'} <span className="text-xs text-gray-400">{un}</span></td>
                        <td className="pr-2 w-8"><button onClick={() => apagarItem(b.id, l)} aria-label={`Apagar ${produto}`} className="p-1.5 text-gray-300 active:text-red-600"><Trash2 size={15} /></button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}

          {soPulv && baixas.length === 0 && <p className="text-center text-sm text-gray-400 py-2">Nenhuma baixa de Pulverização lançada em {dataBR(dia)}.</p>}
          {soPulv && temRequisicao && <RequisicaoPulverizacao data={dia} autor={nome} />}

          {/* Transferências */}
          {transfDoDia.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-gray-700 px-1">Transferências ({transfDoDia.length})</p>
              {transfDoDia.map(t => {
                const src = fotos[`${t.id}:fotoTransf`]
                return (
                  <div key={t.id} className="bg-white rounded-2xl border border-gray-200 p-3 space-y-2">
                    <p className="font-bold text-gray-800">🧪 {(t.produto || '—').toUpperCase()}</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                      <span className="text-gray-500">📊 Saldo ant.: <b className="text-gray-800">{t.saldoAnt || '—'}</b></span>
                      {t.qtdeProgramada && <span className="text-gray-500">📋 Qtde programada: <b className="text-gray-800">{t.qtdeProgramada}</b></span>}
                      <span className="text-gray-500">📦 Qtde transf.: <b className="text-gray-800">{t.qtdeTransf || '—'}</b></span>
                      <span className="text-gray-500">🏠 Estoque: <b className="text-gray-800">{t.estoque || '—'}</b></span>
                      <span className="text-gray-500">🏠 Destino: <b className="text-gray-800">{t.destino || '—'}</b></span>
                      {t.devolucao && <span className="col-span-2 text-gray-500">Devolução: <b className="text-gray-800">{t.devolucao}</b></span>}
                    </div>
                    {src ? (
                      <img src={src} alt={`Foto ${t.produto}`} onClick={() => setFoto(src)} className="w-full max-h-60 object-contain bg-black/5 border border-gray-200 rounded-xl" />
                    ) : (
                      <p className="text-xs text-gray-400">Sem foto</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="space-y-2 pt-1">
            <button onClick={enviar} disabled={enviando} className="w-full flex items-center justify-center gap-2 bg-green-600 active:bg-green-700 disabled:opacity-50 text-white font-bold text-lg rounded-2xl py-4 shadow">
              <Send size={20} /> {enviando ? 'Preparando…' : 'Enviar relatório no WhatsApp'}
            </button>
            {msgEnvio && <p className="text-sm text-center font-semibold text-green-800 bg-green-50 rounded-xl px-3 py-2">{msgEnvio}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={gerarPdf} disabled={gerandoPdf} className="flex items-center justify-center gap-1.5 bg-white border-2 border-green-600 text-green-700 rounded-xl py-3 text-sm font-bold disabled:opacity-50">
                <FileDown size={16} /> {gerandoPdf ? 'Gerando…' : 'Gerar PDF'}
              </button>
              <button onClick={copiar} className="flex items-center justify-center gap-1.5 bg-white border border-gray-300 rounded-xl py-3 text-sm font-semibold text-gray-700">
                {copiado ? <><Check size={16} className="text-green-600" /> Copiado</> : <><Copy size={16} /> Copiar texto</>}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 text-center">{nuvemLigada ? "Mostra o que todos lançaram (este celular e os outros, pela nuvem)." : "Mostra o que foi lançado neste celular."} As fotos vão junto quando o celular deixa compartilhar.</p>
          </div>
        </>
      )}

      {foto && <VisorFoto src={foto} onFechar={() => setFoto(null)} />}
    </div>
  )
}
