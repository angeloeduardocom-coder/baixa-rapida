import { useMemo, useRef, useState } from 'react'
import { Plus, Trash2, Send, Copy, Check, Search, Eraser, ChevronDown, X } from 'lucide-react'
import { PRODUTOS } from '../data/produtos'
import { useLocal, uid, hojeISO } from '../lib/useLocal'
import { gerarExcelBaixa } from '../lib/excelBaixa'
import { tituloBaixa, textoBaixa, abrirWhatsapp, baixarArquivo } from '../lib/textos'

// Busca sem acento e sem diferença de maiúscula (ex: "magnesio" acha "SULFATO DE MAGNÉSIO").
const semAcento = t => String(t || '').normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()

// Pinta de amarelo o pedaço do nome que bate com o que foi digitado.
function Destaque({ texto, termo }) {
  const t = semAcento(termo).trim()
  const i = t ? semAcento(texto).indexOf(t) : -1
  if (i < 0) return texto
  return <>{texto.slice(0, i)}<mark className="bg-yellow-200 rounded px-0.5">{texto.slice(i, i + t.length)}</mark>{texto.slice(i + t.length)}</>
}

const campo = 'w-full border border-gray-300 focus:border-green-600 focus:ring-2 focus:ring-green-200 rounded-xl px-3 py-2.5 text-base bg-white outline-none'

export default function Baixa() {
  const [ferti, setFerti] = useLocal('baixa:ferti', 2)
  const [data, setData] = useState(hojeISO())
  const [porDia, setPorDia] = useLocal('baixa:porDia', {})
  const [extras, setExtras] = useLocal('baixa:produtosExtras', [])
  const [busca, setBusca] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const chave = `${data}|${ferti}`
  // Baixa antiga tinha Consumo e Quant. separados — agora é um campo só (Quantidade).
  const linhas = (porDia[chave] || []).map(l => (l.quant || !l.consumo ? l : { ...l, quant: l.consumo }))
  const setLinhas = fn => setPorDia(p => ({ ...p, [chave]: fn(p[chave] || []) }))

  const catalogo = useMemo(() => [...PRODUTOS, ...extras.map(n => ({ nome: n, unidade: 'L' }))], [extras])
  const jaTem = new Set(linhas.map(l => l.produto.toUpperCase()))
  // Lista da barra de produtos: em ordem alfabética; digitando, primeiro os que COMEÇAM com o
  // texto, depois os que só contêm. Os que já estão na baixa não aparecem.
  const sugestoes = useMemo(() => {
    const t = semAcento(busca).trim()
    const lista = catalogo
      .filter(p => !jaTem.has(p.nome.toUpperCase()) && (!t || semAcento(p.nome).includes(t)))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    if (!t) return lista
    return [...lista.filter(p => semAcento(p.nome).startsWith(t)), ...lista.filter(p => !semAcento(p.nome).startsWith(t))]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, catalogo, linhas])
  const [listaAberta, setListaAberta] = useState(false)
  const [marcado, setMarcado] = useState(0)
  const buscaRef = useRef(null)
  const nomeNovo = busca.trim().toUpperCase()
  const podeCriar = nomeNovo && !catalogo.some(p => p.nome.toUpperCase() === nomeNovo) && !jaTem.has(nomeNovo)

  function adicionar(nome, unidade = 'L') {
    setLinhas(ls => [...ls, { id: uid(), produto: nome, unidade, quant: '' }])
    setBusca('')
    setListaAberta(false)
    setMarcado(0)
  }
  function criarProduto() {
    setExtras(e => [...e, nomeNovo])
    adicionar(nomeNovo)
  }
  const atualizar = (id, c, v) => setLinhas(ls => ls.map(l => (l.id === id ? { ...l, [c]: v } : l)))
  const remover = id => setLinhas(ls => ls.filter(l => l.id !== id))

  const titulo = tituloBaixa(ferti, data)
  const texto = textoBaixa(ferti, data, linhas)

  async function enviar() {
    if (!linhas.length || enviando) return
    setEnviando(true)
    try {
      const blob = await gerarExcelBaixa(titulo, linhas)
      const arq = new File([blob], `baixa_ferti${ferti}_${data}.xlsx`, { type: blob.type })
      if (navigator.canShare?.({ files: [arq] })) { await navigator.share({ files: [arq] }); return }
      baixarArquivo(blob, arq.name) // PC: baixa o Excel e abre o WhatsApp pra anexar
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
          {[1, 2].map(n => (
            <button key={n} onClick={() => setFerti(n)} className={`flex-1 py-3 rounded-xl font-bold text-base border-2 transition-colors ${ferti === n ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-600'}`}>
              Ferti {n}
            </button>
          ))}
        </div>
        <input type="date" value={data} onChange={e => e.target.value && setData(e.target.value)} className={`${campo} font-semibold text-green-700`} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-3 space-y-2">
        <p className="text-sm font-bold text-gray-700">Adicionar produto</p>
        {/* Barra de produtos: toca/digita e a lista vai aparecendo e filtrando (setas + Enter também). */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            ref={buscaRef}
            value={busca}
            onChange={e => { setBusca(e.target.value); setListaAberta(true); setMarcado(0) }}
            onFocus={() => setListaAberta(true)}
            onBlur={() => setTimeout(() => setListaAberta(false), 150)}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setListaAberta(true); setMarcado(m => Math.min(m + 1, sugestoes.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setMarcado(m => Math.max(m - 1, 0)) }
              else if (e.key === 'Enter') {
                e.preventDefault()
                const p = sugestoes[marcado]
                if (p) adicionar(p.nome, p.unidade)
                else if (podeCriar) criarProduto()
              } else if (e.key === 'Escape') setListaAberta(false)
            }}
            placeholder="Toque e escolha, ou digite o nome…"
            className={`${campo} pl-10 pr-10`}
            role="combobox"
            aria-expanded={listaAberta}
          />
          {busca ? (
            <button onMouseDown={e => e.preventDefault()} onClick={() => { setBusca(''); buscaRef.current?.focus() }} aria-label="Limpar" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400"><X size={18} /></button>
          ) : (
            <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          )}
          {listaAberta && (sugestoes.length > 0 || podeCriar) && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-72 overflow-y-auto">
              <p className="sticky top-0 bg-gray-50 border-b border-gray-100 px-3 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                {busca.trim() ? `${sugestoes.length} produto(s) encontrado(s)` : `${sugestoes.length} produtos · A–Z`}
              </p>
              {sugestoes.map((p, i) => (
                <button
                  key={p.nome}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => adicionar(p.nome, p.unidade)}
                  onMouseEnter={() => setMarcado(i)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-[15px] border-b border-gray-50 ${i === marcado ? 'bg-green-50' : 'bg-white'}`}
                >
                  <Plus size={16} className="text-green-600 shrink-0" />
                  <span className="flex-1 font-semibold text-gray-800"><Destaque texto={p.nome} termo={busca} /></span>
                  <span className="text-xs font-bold text-gray-400">{p.unidade}</span>
                </button>
              ))}
              {podeCriar && (
                <button onMouseDown={e => e.preventDefault()} onClick={criarProduto} className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-[15px] bg-amber-50 text-amber-800 font-semibold">
                  <Plus size={16} className="shrink-0" /> Criar produto “{nomeNovo}”
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {linhas.length === 0 && <p className="text-center text-gray-400 py-8">Toque na barra acima e escolha os produtos para montar a baixa do dia.</p>}

      {linhas.map(l => (
        <div key={l.id} className="bg-white rounded-2xl border border-gray-200 p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <p className="flex-1 font-bold text-gray-800 text-base">{l.produto}</p>
            <button onClick={() => remover(l.id)} aria-label="Remover" className="p-2 text-gray-300 hover:text-red-500"><Trash2 size={18} /></button>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-gray-500">Quantidade</span>
            <div className="flex gap-1.5">
              <input inputMode="decimal" value={l.quant ?? ''} onChange={e => atualizar(l.id, 'quant', e.target.value)} placeholder="0,0" className={campo} />
              {/* Unidade fixa, a que veio do cadastro do produto (não troca aqui). */}
              <span className="px-4 flex items-center rounded-xl border border-gray-200 font-bold text-green-700 bg-green-50 shrink-0">{l.unidade}</span>
            </div>
          </label>
        </div>
      ))}

      {linhas.length > 0 && (
        <div className="space-y-2 pt-1">
          <button onClick={enviar} disabled={enviando} className="w-full flex items-center justify-center gap-2 bg-green-600 active:bg-green-700 disabled:opacity-50 text-white font-bold text-lg rounded-2xl py-4 shadow">
            <Send size={20} /> {enviando ? 'Preparando…' : 'Enviar no WhatsApp'}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={copiar} className="flex items-center justify-center gap-1.5 bg-white border border-gray-300 rounded-xl py-3 text-sm font-semibold text-gray-700">{copiado ? <Check size={16} className="text-green-600" /> : <Copy size={16} />} {copiado ? 'Copiado' : 'Texto'}</button>
            <button onClick={() => { if (confirm('Limpar a baixa deste dia?')) setLinhas(() => []) }} className="flex items-center justify-center gap-1.5 bg-white border border-gray-300 rounded-xl py-3 text-sm font-semibold text-red-600"><Eraser size={16} /> Limpar</button>
          </div>
          <p className="text-[11px] text-gray-400 text-center">No celular abre o WhatsApp com a planilha em Excel. No computador baixa o Excel e abre o WhatsApp.</p>
        </div>
      )}
    </div>
  )
}
