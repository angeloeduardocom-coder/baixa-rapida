import { useEffect, useMemo, useRef, useState } from 'react'
import { Trash2, Send, Copy, Check, Eraser, Save, FolderOpen, RotateCcw, Cloud, CloudOff } from 'lucide-react'
import { PRODUTOS } from '../data/produtos'
import { useLocal, uid, hojeISO, diaMes } from '../lib/useLocal'
import { gerarPdfBaixa, nomePdfBaixa, aquecerPdf } from '../lib/pdfBaixa'
import RequisicaoPulverizacao from './RequisicaoPulverizacao'
import { nuvemLigada, enderecoNuvem, lerBaixasNuvem, enviarBaixaNuvem, paraApp, meuAparelho } from '../lib/nuvem'
import { publicarAviso, perfisDoTipo, mudouDesdeUltimoAviso, lembrarAviso } from '../lib/avisosNuvem'
import { tituloBaixa, textoBaixa, abrirWhatsapp, baixarArquivo } from '../lib/textos'

// Busca sem acento e sem diferença de maiúscula (ex: "magnesio" acha "SULFATO DE MAGNÉSIO").
const semAcento = t => String(t || '').normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()

const NOME_TIPO = { 1: 'Ferti 1', 2: 'Ferti 2', pulv: 'Pulverização' }
const ontemISO = () => { const d = new Date(`${hojeISO()}T12:00:00`); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) }
const diaLongo = iso => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
const tipoDaChave = t => (t === 'pulv' ? 'pulv' : Number(t))
const hora = iso => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const mesmaLista = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || [])

const campo = 'w-full border border-gray-300 focus:border-green-600 focus:ring-2 focus:ring-green-200 rounded-xl px-3 py-2.5 text-base bg-white outline-none'

export default function Baixa({ perfil, nome }) {
  // Cada perfil só lança no(s) seu(s) campo(s): Ferti 1, Ferti 2 ou Pulverização (Gestor vê tudo).
  const tipos = perfil?.tipos || [1, 2, 'pulv']
  const [fertiSalvo, setFerti] = useLocal('baixa:ferti', tipos[0])
  const ferti = tipos.includes(fertiSalvo) ? fertiSalvo : tipos[0]
  const [data, setData] = useState(hojeISO())
  const [porDia, setPorDia] = useLocal('baixa:porDia', {})
  const [extras, setExtras] = useLocal('baixa:produtosExtras', [])
  const [busca, setBusca] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  // Cópia de segurança de cada baixa, feita no botão Salvar (e ao enviar): mesmo se a lista
  // do dia for limpa ou a data mudar, dá pra abrir/recuperar daqui. Chave = "data|tipo".
  const [salvos, setSalvos] = useLocal('baixa:salvos', {})
  const [aviso, setAviso] = useState('')
  // Nuvem: ids que este aparelho já enviou em cada "data|tipo" (o que saiu da lista aqui some da
  // nuvem também) e a fila do que ficou sem subir por falta de internet.
  const [conhecidos, setConhecidos] = useLocal('baixa:enviados', {})
  // O que OUTRAS pessoas lançaram no mesmo dia (outros celulares / tela do sistema) — só leitura.
  const [outros, setOutros] = useState([])
  const [fila, setFila] = useLocal('baixa:filaNuvem', [])
  const [erroEnvio, setErroEnvio] = useState('')
  const porDiaRef = useRef(porDia); porDiaRef.current = porDia
  const conhecidosRef = useRef(conhecidos); conhecidosRef.current = conhecidos
  const chaveRef = useRef('')

  const chave = `${data}|${ferti}`
  // Baixa antiga tinha Consumo e Quant. separados — agora é um campo só (Quantidade).
  const linhas = (porDia[chave] || []).map(l => (l.quant || !l.consumo ? l : { ...l, quant: l.consumo }))
  const setLinhas = fn => setPorDia(p => ({ ...p, [chave]: fn(p[chave] || []) }))

  const catalogo = useMemo(() => [...PRODUTOS, ...extras.map(n => ({ nome: n, unidade: 'L' }))], [extras])
  const [qtdNova, setQtdNova] = useState('')
  const [erroForm, setErroForm] = useState('')
  function adicionarBaixa() {
    const nomeP = busca.trim().toUpperCase().replace(/\s+/g, ' ')
    const q = qtdNova.trim()
    if (!nomeP) { setErroForm('Digite o produto.'); return }
    if (!q) { setErroForm('Digite a quantidade.'); return }
    const doCatalogo = catalogo.find(p => semAcento(p.nome) === semAcento(nomeP))
    setLinhas(ls => [...ls, { id: uid(), produto: doCatalogo?.nome || nomeP, unidade: doCatalogo?.unidade || '', quant: q }])
    if (!doCatalogo) setExtras(e => (e.includes(nomeP) ? e : [...e, nomeP]))
    setBusca(''); setQtdNova(''); setErroForm('')
  }
  const atualizar = (id, c, v) => setLinhas(ls => ls.map(l => (l.id === id ? { ...l, [c]: v } : l)))
  const remover = id => setLinhas(ls => ls.filter(l => l.id !== id))

  const salvo = salvos[chave]
  const salvoAtual = salvo && mesmaLista(salvo.linhas, linhas)

  // Sobe uma baixa ("data|tipo") pra nuvem. Sem internet, entra na fila e tenta de novo depois.
  async function subir(k, ls) {
    if (!nuvemLigada) return false
    const [d, t] = k.split('|')
    try {
      const deOutros = await enviarBaixaNuvem(d, tipoDaChave(t), ls, conhecidosRef.current[k] || [], nome)
      if (k === chaveRef.current) setOutros(deOutros.map(i => paraApp(i, PRODUTOS)))
      setConhecidos(c => ({ ...c, [k]: ls.map(l => l.id) }))
      setSalvos(s => (s[k] ? { ...s, [k]: { ...s[k], nuvemEm: new Date().toISOString() } } : s))
      setFila(f => f.filter(x => x !== k))
      setErroEnvio('')
      return true
    } catch (e) {
      setErroEnvio(`${[e?.message, e?.details, e?.hint, e?.code].filter(Boolean).join(' · ') || String(e)} — endereço: ${enderecoNuvem}`)
      setFila(f => (f.includes(k) ? f : [...f, k]))
      return false
    }
  }

  async function salvar(marcarEnviado = false) {
    const agora = new Date().toISOString()
    setSalvos(s => ({ ...s, [chave]: { linhas, salvoEm: agora, enviadoEm: marcarEnviado ? agora : s[chave]?.enviadoEm || null, nuvemEm: s[chave]?.nuvemEm || null } }))
    const foi = await subir(chave, linhas)
    // Aviso pros outros só quando salva de verdade na nuvem (botão Salvar ou Enviar).
    // …e só se a baixa mudou desde o último aviso (salvar igual de novo não notifica).
    const tagAviso = `baixa:${ferti}:${data}`
    if (foi && linhas.length && mudouDesdeUltimoAviso(tagAviso, linhas)) {
      publicarAviso({ perfis: perfisDoTipo(ferti), titulo: `Baixa salva — ${ferti === 'pulv' ? 'Pulverização' : `Ferti ${ferti}`}`, corpo: `${nome || 'Alguém'} salvou ${linhas.length} item(ns) em ${diaMes(data)}`, tag: tagAviso, autor: nome || null })
        .then(ok => ok && lembrarAviso(tagAviso, linhas))
    }
    if (!marcarEnviado) {
      setAviso(!nuvemLigada ? `Baixa salva neste aparelho às ${hora(agora)}`
        : foi ? `Baixa salva na nuvem às ${hora(agora)}` : 'Salva no aparelho. Vai para a nuvem quando tiver internet.')
      setTimeout(() => setAviso(''), 3000)
    }
  }

  // Ao abrir um dia, mostra (só pra consulta) o que outras pessoas já lançaram nele.
  chaveRef.current = chave
  useEffect(() => {
    setOutros([])
    if (!nuvemLigada) return
    let ativo = true
    lerBaixasNuvem(ferti).then(itens => {
      if (!ativo) return
      const meus = new Set([...(porDiaRef.current[chave] || []).map(l => l.id), ...(conhecidosRef.current[chave] || [])])
      setOutros(itens.filter(i => i.data === data && i.aparelho !== meuAparelho && !meus.has(i.id)).map(i => paraApp(i, PRODUTOS)))
    }).catch(() => {})
    return () => { ativo = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])

  // Fila: tenta subir de novo ao abrir o app e quando a internet volta.
  useEffect(() => {
    if (!nuvemLigada) return
    const tentar = () => { for (const k of fila) subir(k, porDiaRef.current[k] || []) }
    tentar()
    window.addEventListener('online', tentar)
    return () => window.removeEventListener('online', tentar)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fila.length])
  function recuperar() {
    if (salvo?.linhas?.length) setPorDia(p => ({ ...p, [chave]: salvo.linhas }))
  }
  // Abre uma baixa guardada de outro dia/tipo (a data volta pra hoje sempre que o app abre,
  // então a de ontem "sumia" da tela — ela continua aqui).
  function abrirGuardada(k) {
    const [d, t] = k.split('|')
    setData(d)
    setFerti(tipoDaChave(t))
    if (!(porDia[k] || []).length && salvos[k]?.linhas?.length) setPorDia(p => ({ ...p, [k]: salvos[k].linhas }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  // "Em aberto": rascunho que ainda não foi salvo de verdade (Salvar/Enviar). Depois de salvo vai
  // pro Histórico, no dia dele, e sai desta lista.
  const emAberto = k => {
    const ls = porDia[k] || []
    if (!ls.length) return false
    const s = salvos[k]
    const salvoDeVerdade = s && mesmaLista(s.linhas, ls) && (!nuvemLigada || s.nuvemEm || s.enviadoEm)
    return !salvoDeVerdade
  }
  const guardadas = useMemo(() => {
    const ks = Object.keys(porDia).filter(emAberto)
    return ks.filter(k => k !== chave && tipos.includes(tipoDaChave(k.split('|')[1])))
      .sort((a, b) => b.localeCompare(a)).slice(0, 8).map(k => ({
        k, data: k.split('|')[0], tipo: NOME_TIPO[tipoDaChave(k.split('|')[1])] || k.split('|')[1], n: porDia[k].length,
      }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [porDia, salvos, chave, perfil?.id])
  // Apaga o rascunho daqui (caso tenha sido feito por acaso). O que já foi pra nuvem não é mexido.
  function apagarGuardada(k) {
    const g = guardadas.find(x => x.k === k)
    if (!window.confirm(`Apagar a baixa de ${diaMes(g?.data || k.split('|')[0])} (${g?.tipo || ''}) que está neste aparelho? Ela não será enviada.`)) return
    setPorDia(p => { const { [k]: _, ...resto } = p; return resto })
    setSalvos(s => (s[k] && !s[k].nuvemEm ? Object.fromEntries(Object.entries(s).filter(([x]) => x !== k)) : s))
    setFila(f => f.filter(x => x !== k))
  }

  const titulo = tituloBaixa(ferti, data)
  const texto = textoBaixa(ferti, data, linhas)

  // PDF da baixa (modelo da planilha) fica pronto ANTES do toque: o celular só deixa anexar
  // arquivo logo depois do toque. Vai direto como documento no WhatsApp ("ferti1 baixa.pdf").
  const pdfPronto = useRef({ chave: '', arq: null })
  const chavePdf = `${ferti}|${data}|${JSON.stringify(linhas.map(l => [l.produto, l.quant]))}`
  useEffect(() => {
    if (!linhas.length) return
    let ativo = true
    const t = setTimeout(() => {
      gerarPdfBaixa(titulo, linhas, data).then(blob => { if (ativo) pdfPronto.current = { chave: chavePdf, arq: new File([blob], nomePdfBaixa(ferti), { type: 'application/pdf' }) } }).catch(() => {})
    }, 600)
    return () => { ativo = false; clearTimeout(t) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chavePdf])
  useEffect(() => { aquecerPdf() }, [])

  async function enviar() {
    if (!linhas.length || enviando) return
    salvar(true) // sempre guarda antes de mandar
    setEnviando(true)
    try {
      const arq = pdfPronto.current.chave === chavePdf ? pdfPronto.current.arq
        : new File([await gerarPdfBaixa(titulo, linhas, data)], nomePdfBaixa(ferti), { type: 'application/pdf' })
      if (navigator.canShare?.({ files: [arq] })) { await navigator.share({ files: [arq], text: titulo }); return }
      baixarArquivo(arq, arq.name) // PC: baixa o PDF e abre o WhatsApp pra anexar
      abrirWhatsapp(texto)
    } catch (e) {
      if (e?.name !== 'AbortError') abrirWhatsapp(texto)
    } finally { setEnviando(false) }
  }
  function copiar() {
    navigator.clipboard?.writeText(texto).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1800) })
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-3 space-y-3">
        <div className="flex gap-2">
          {[[1, 'Ferti 1'], [2, 'Ferti 2'], ['pulv', 'Pulverização']].filter(([n]) => tipos.includes(n)).map(([n, rotulo]) => (
            <button key={n} onClick={() => setFerti(n)} className={`flex-1 py-3 px-1 rounded-xl font-bold text-[15px] border-2 transition-colors ${ferti === n ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-600'}`}>
              {rotulo}
            </button>
          ))}
        </div>
        {/* 13/11/2026 (modelo do Ângelo): "Data das baixas" com atalhos Hoje / Ontem. */}
        <div className="rounded-xl bg-green-50 border border-green-200 p-3 space-y-2">
          <p className="text-sm font-bold text-green-800">Data das baixas</p>
          <input type="date" value={data} onChange={e => e.target.value && setData(e.target.value)} className={`${campo} font-bold text-center text-gray-900`} />
          <div className="flex gap-2">
            {[['Hoje', hojeISO()], ['Ontem', ontemISO()]].map(([t, d]) => (
              <button key={t} onClick={() => setData(d)} className={`px-5 py-2 rounded-xl text-[15px] font-bold border ${data === d ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      {ferti === 'pulv' && <RequisicaoPulverizacao data={data} autor={nome} />}

      {guardadas.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-3 space-y-1.5">
          <p className="text-sm font-bold text-gray-700 flex items-center gap-1.5"><FolderOpen size={16} className="text-green-700" /> Baixas em aberto neste aparelho <span className="font-normal text-gray-400">(ainda não salvas)</span></p>
          {guardadas.map(g => (
            <div key={g.k} className="flex items-stretch gap-1.5">
              <button onClick={() => abrirGuardada(g.k)} className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 active:bg-green-50 text-left">
                <span className="font-bold text-gray-800">{diaMes(g.data)}</span>
                <span className="text-sm text-gray-600">{g.tipo}</span>
                <span className="text-xs text-gray-400">· {g.n} produto(s)</span>
                <span className="ml-auto text-[11px] font-bold rounded-full px-2 py-0.5 bg-amber-100 text-amber-700">Em aberto</span>
              </button>
              <button onClick={() => apagarGuardada(g.k)} aria-label="Apagar esta baixa" title="Apagar" className="px-3 rounded-xl border border-red-100 bg-red-50 text-red-600 active:bg-red-100"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}

      {/* 13/11/2026 (modelo do Ângelo): digita o produto e a quantidade e toca em "Adicionar baixa". */}
      <div className="bg-white rounded-2xl border border-gray-200 p-3 space-y-3">
        <label className="block">
          <span className="text-sm font-bold text-gray-600">Produto</span>
          <input value={busca} onChange={e => { setBusca(e.target.value); setErroForm('') }} list="produtos-baixa" placeholder="Ex.: Nitrato de cálcio" autoCapitalize="characters" autoComplete="off" className={`${campo} mt-1 uppercase placeholder:normal-case`} />
          <datalist id="produtos-baixa">{catalogo.map(p => <option key={p.nome} value={p.nome} />)}</datalist>
        </label>
        <label className="block">
          <span className="text-sm font-bold text-gray-600">Quantidade</span>
          <input value={qtdNova} onChange={e => { setQtdNova(e.target.value); setErroForm('') }} onKeyDown={e => { if (e.key === 'Enter') adicionarBaixa() }} placeholder="Ex.: 25" inputMode="decimal" className={`${campo} mt-1`} />
        </label>
        {erroForm && <p className="text-sm font-semibold text-red-600">{erroForm}</p>}
        <button onClick={adicionarBaixa} className="w-full bg-green-600 active:bg-green-700 text-white font-bold text-lg rounded-xl py-3.5">Adicionar baixa</button>
      </div>

      {outros.length > 0 && (
        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3 space-y-1">
          <p className="text-sm font-bold text-sky-800">Já lançado por outras pessoas nesta data ({outros.length})</p>
          {outros.map(o => (
            <div key={o.id} className="flex items-center gap-2 text-sm text-sky-900">
              <span className="flex-1 font-semibold">{o.produto}</span>
              <span>{o.quant || '—'} {o.unidade}</span>
              <span className="text-[10px] font-bold uppercase text-sky-600">{o.origem === 'app' ? 'outro celular' : 'sistema'}</span>
            </div>
          ))}
          <p className="text-[11px] text-sky-700">Isso não muda. Lance abaixo só o que <b>você</b> retirou: tudo soma no sistema.</p>
        </div>
      )}

      {linhas.length === 0 && salvo?.linhas?.length > 0 && (
        <button onClick={recuperar} className="w-full flex items-center justify-center gap-2 bg-amber-50 border-2 border-amber-300 text-amber-800 font-bold rounded-2xl py-3.5">
          <RotateCcw size={18} /> Recuperar baixa salva ({salvo.linhas.length} produto(s), às {hora(salvo.salvoEm)})
        </button>
      )}
      <div>
        <h3 className="text-lg font-extrabold text-gray-900">Lançamentos do dia</h3>
        <p className="text-sm text-gray-500 capitalize">{diaLongo(data)} · {NOME_TIPO[ferti]}</p>
      </div>
      {linhas.length === 0 && (
        <p className="text-center text-[15px] text-gray-500 border-2 border-dashed border-gray-200 rounded-2xl px-4 py-6">
          Nenhuma baixa lançada em {diaMes(data)}. Preencha o produto e a quantidade acima e toque em Adicionar baixa.
        </p>
      )}
      <div className="space-y-1.5">
        {linhas.map(l => (
          <div key={l.id} className="flex items-center gap-2 bg-white rounded-2xl border border-gray-200 pl-3 pr-1 py-2">
            <p className="flex-1 min-w-0 font-bold text-gray-800 text-base truncate">{l.produto}</p>
            <input value={l.quant ?? ''} onChange={e => atualizar(l.id, 'quant', e.target.value)} inputMode="decimal" aria-label={`Quantidade de ${l.produto}`} className="w-20 text-right font-mono font-extrabold text-gray-900 border border-transparent focus:border-green-500 rounded-lg px-2 py-1.5 outline-none" />
            {l.unidade && <span className="text-xs font-bold text-green-700">{l.unidade}</span>}
            <button onClick={() => remover(l.id)} aria-label={`Apagar ${l.produto}`} className="p-2 text-gray-300 active:text-red-500"><Trash2 size={18} /></button>
          </div>
        ))}
      </div>

      {linhas.length > 0 && (
        <div className="space-y-2 pt-1">
          <button onClick={() => salvar()} className={`w-full flex items-center justify-center gap-2 font-bold text-lg rounded-2xl py-3.5 border-2 ${salvoAtual ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-green-600 text-green-700 active:bg-green-50'}`}>
            {salvoAtual ? <Check size={20} /> : <Save size={20} />} {salvoAtual ? `Salva às ${hora(salvo.salvoEm)}` : 'Salvar baixa'}
          </button>
          {aviso && <p className="text-center text-sm font-semibold text-green-700">{aviso}</p>}
          {nuvemLigada && salvo && (
            fila.includes(chave)
              ? <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-700"><CloudOff size={14} /> Ainda não subiu para a nuvem — envia sozinho quando tiver internet.{erroEnvio && <span className="block text-[11px] font-normal text-gray-500 break-all">Motivo: {erroEnvio}</span>}</p>
              : salvo.nuvemEm && <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-sky-700"><Cloud size={14} /> Na nuvem às {hora(salvo.nuvemEm)} — o sistema já vê esta baixa.</p>
          )}
          {!salvoAtual && salvo && <p className="text-center text-xs font-semibold text-amber-700">Tem alterações depois do último salvamento ({hora(salvo.salvoEm)}).</p>}
          <button onClick={enviar} disabled={enviando} className="w-full flex items-center justify-center gap-2 bg-green-600 active:bg-green-700 disabled:opacity-50 text-white font-bold text-lg rounded-2xl py-4 shadow">
            <Send size={20} /> {enviando ? 'Preparando…' : 'Enviar no WhatsApp'}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={copiar} className="flex items-center justify-center gap-1.5 bg-white border border-gray-300 rounded-xl py-3 text-sm font-semibold text-gray-700">{copiado ? <Check size={16} className="text-green-600" /> : <Copy size={16} />} {copiado ? 'Copiado' : 'Texto'}</button>
            <button onClick={() => { if (confirm('Limpar a baixa deste dia?')) setLinhas(() => []) }} className="flex items-center justify-center gap-1.5 bg-white border border-gray-300 rounded-xl py-3 text-sm font-semibold text-red-600"><Eraser size={16} /> Limpar</button>
          </div>
          <p className="text-[11px] text-gray-400 text-center">Ao enviar, a baixa também é salva. No celular abre o WhatsApp com a planilha em Excel. No computador baixa o Excel e abre o WhatsApp.</p>
        </div>
      )}
    </div>
  )
}
