import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, X, Send, Copy, Check, Camera, ImagePlus, Cloud, CloudOff } from 'lucide-react'
import { PRODUTOS } from '../data/produtos'
import { useLocal, uid, hojeISO, diaMes } from '../lib/useLocal'
import { comprimirImagem, carimbarFoto, salvarFotoLocal, lerFotosLocais } from '../lib/fotos'
import { textoTransferencias, abrirWhatsapp } from '../lib/textos'
import { nuvemLigada, sincronizarTransferencias, enviarFoto, baixarFoto } from '../lib/nuvem'

const campo = 'w-full border border-gray-300 focus:border-green-600 focus:ring-2 focus:ring-green-200 rounded-xl px-3 py-2.5 text-base bg-white outline-none'

function VisorFoto({ src, onFechar }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-2" onClick={onFechar}>
      <img src={src} alt="Foto" className="max-w-full max-h-full object-contain" />
      <button className="absolute top-3 right-3 bg-white/15 text-white rounded-full p-2"><X size={20} /></button>
    </div>
  )
}

function CampoFoto({ rotulo, valor, onChange }) {
  const camera = useRef(null)
  const galeria = useRef(null)
  const [aberta, setAberta] = useState(false)
  const [erro, setErro] = useState('')
  async function escolher(e) {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    try { setErro(''); onChange(await comprimirImagem(arquivo)) } catch (err) { setErro(err.message) }
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-gray-500 mr-auto">{rotulo}</span>
        <button onClick={() => camera.current?.click()} className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-semibold"><Camera size={16} /> {valor ? 'Tirar outra' : 'Tirar foto'}</button>
        <button onClick={() => galeria.current?.click()} className="flex items-center gap-1.5 border border-gray-300 text-gray-600 px-3 py-2 rounded-lg text-sm font-semibold"><ImagePlus size={16} /> Galeria</button>
        <input ref={camera} type="file" accept="image/*" capture="environment" onChange={escolher} className="hidden" />
        <input ref={galeria} type="file" accept="image/*" onChange={escolher} className="hidden" />
      </div>
      {erro && <p className="text-xs text-red-500">{erro}</p>}
      {valor && (
        <div className="relative">
          <img src={valor} alt={rotulo} onClick={() => setAberta(true)} className="w-full max-h-72 object-contain bg-black/5 border border-gray-200 rounded-xl" />
          <button onClick={() => onChange('')} aria-label="Remover foto" className="absolute top-2 right-2 bg-white/90 text-red-500 rounded-full p-1.5 shadow"><Trash2 size={14} /></button>
          <span className="absolute bottom-2 right-2 bg-black/55 text-white text-[10px] px-2 py-0.5 rounded-full">toque para ampliar</span>
        </div>
      )}
      {aberta && valor && <VisorFoto src={valor} onFechar={() => setAberta(false)} />}
    </div>
  )
}

const CAMPOS = [['saldoAnt', '📊 Saldo ant.'], ['qtdeTransf', '📦 Qtde transf.'], ['estoque', '🏠 Estoque'], ['destino', '🏠 Destino']]

export default function Transferencia() {
  const [lista, setLista] = useLocal('transf:lista', [])
  const [fotos, setFotos] = useState({}) // { 'id:campo': dataUrl }
  const [data, setData] = useState(hojeISO())
  const [copiado, setCopiado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => { lerFotosLocais().then(setFotos).catch(() => {}) }, [])

  // ---------- Nuvem ----------
  // Itens apagados neste aparelho (pra não voltarem da nuvem) e estado da sincronização.
  const [apagados, setApagados] = useLocal('transf:apagados', [])
  const [estadoNuvem, setEstadoNuvem] = useState(nuvemLigada ? 'sincronizando' : 'desligada')
  const listaRef = useRef(lista); listaRef.current = lista
  const fotosRef = useRef(fotos); fotosRef.current = fotos
  const ultimoEnvio = useRef('')
  const rodando = useRef(false)

  async function sincronizar() {
    if (!nuvemLigada || rodando.current) return
    rodando.current = true
    try {
      // 1) Sobe as fotos novas (tiradas aqui e ainda sem endereço na nuvem).
      const inicio = listaRef.current
      let local = inicio
      for (const t of local) {
        const src = fotosRef.current[`${t.id}:fotoTransf`]
        if (src && !t.fotoTransfUrl && src.startsWith('data:')) {
          const url = await enviarFoto(t.id, src)
          local = local.map(x => (x.id === t.id ? { ...x, fotoTransfUrl: url } : x))
        }
      }
      // 2) Junta com a nuvem e grava.
      const junta = await sincronizarTransferencias(local, apagados)
      ultimoEnvio.current = JSON.stringify(junta)
      setLista(cur => {
        if (cur === inicio) return junta
        // Mexeram durante a sincronização: mantém o que foi digitado, só põe os endereços das
        // fotos e os itens novos da nuvem (a próxima sincronização sobe o resto).
        const urls = new Map(local.filter(x => x.fotoTransfUrl).map(x => [x.id, x.fotoTransfUrl]))
        const ids = new Set(cur.map(x => x.id))
        return [...cur.map(x => (urls.has(x.id) && !x.fotoTransfUrl && x.fotoTransfUrl !== null ? { ...x, fotoTransfUrl: urls.get(x.id) } : x)), ...junta.filter(x => !ids.has(x.id) && !inicio.some(i => i.id === x.id))]
      })
      setEstadoNuvem('ok')
    } catch {
      setEstadoNuvem('pendente')
    } finally { rodando.current = false }
  }

  // Ao abrir, quando a internet volta e 1,5 s depois de cada mudança.
  useEffect(() => {
    if (!nuvemLigada) return
    window.addEventListener('online', sincronizar)
    return () => window.removeEventListener('online', sincronizar)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apagados])
  useEffect(() => {
    if (!nuvemLigada || JSON.stringify(lista) === ultimoEnvio.current) return
    setEstadoNuvem('sincronizando')
    const t = setTimeout(sincronizar, 1500)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista, apagados])

  // Fotos que vieram de outro celular: baixa as do dia aberto pra mostrar e mandar no WhatsApp.
  useEffect(() => {
    for (const t of lista) {
      const k = `${t.id}:fotoTransf`
      if (t.data === data && t.fotoTransfUrl && !fotos[k]) {
        baixarFoto(t.fotoTransfUrl).then(src => setFotos(f => (f[k] ? f : { ...f, [k]: src }))).catch(() => {})
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, lista])

  const doDia = lista.filter(t => t.data === data)
  const comFotos = doDia.map(t => ({ ...t, temFotoTransf: !!fotos[`${t.id}:fotoTransf`], temFotoDevolucao: false }))
  const nomes = useMemo(() => PRODUTOS.map(p => p.nome), [])

  const adicionar = () => setLista(l => [...l, { id: uid(), data, produto: '', saldoAnt: '', qtdeTransf: '', estoque: '', destino: '', devolucao: '' }])
  const atualizar = (id, c, v) => setLista(l => l.map(t => (t.id === id ? { ...t, [c]: v } : t)))
  function remover(id) {
    ;['fotoTransf', 'fotoDevolucao'].forEach(c => salvarFotoLocal(`${id}:${c}`, '').catch(() => {}))
    setFotos(f => { const n = { ...f }; delete n[`${id}:fotoTransf`]; delete n[`${id}:fotoDevolucao`]; return n })
    setLista(l => l.filter(t => t.id !== id))
    setApagados(a => (a.includes(id) ? a : [...a, id]))
  }
  function setFoto(id, c, valor) {
    const chave = `${id}:${c}`
    setFotos(f => { const n = { ...f }; if (valor) n[chave] = valor; else delete n[chave]; return n })
    salvarFotoLocal(chave, valor).then(() => setErro('')).catch(() => setErro('Não consegui guardar a foto neste aparelho.'))
    // Foto trocada ou removida: a da nuvem deixa de valer (a nova sobe na próxima sincronização).
    if (c === 'fotoTransf') atualizar(id, 'fotoTransfUrl', null)
  }

  async function arquivosFotos(itens) {
    const arqs = []
    for (let i = 0; i < itens.length; i++) {
      const t = itens[i]
      const nome = (t.produto || `PRODUTO ${i + 1}`).toUpperCase()
      const base = nome.replace(/[^\w-]+/g, '_')
      // Uma foto só por produto (a do produto transferido) — a da devolução saiu, era a mesma.
      for (const [campo_, rot] of [['fotoTransf', 'TRANSFERÊNCIA']]) {
        const src = fotos[`${t.id}:${campo_}`]
        if (src) arqs.push(new File([await carimbarFoto(src, `${nome} — ${rot} · ${diaMes(data)}`)], `${i + 1}_${base}_${rot.toLowerCase()}.jpg`, { type: 'image/jpeg' }))
      }
    }
    return arqs
  }

  async function enviar(itens = comFotos) {
    if (enviando || !itens.length) return
    setEnviando(true)
    const texto = textoTransferencias(data, itens)
    try {
      const arqs = await arquivosFotos(itens)
      if (arqs.length && navigator.canShare?.({ files: arqs })) { await navigator.share({ text: texto, files: arqs }); return }
    } catch (e) { if (e?.name === 'AbortError') return } finally { setEnviando(false) }
    abrirWhatsapp(textoTransferencias(data, itens))
  }
  function copiar() {
    navigator.clipboard?.writeText(textoTransferencias(data, comFotos)).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1800) })
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-3">
        <p className="text-sm font-bold text-gray-700 mb-2">Saldo anterior e transferências</p>
        <input type="date" value={data} onChange={e => e.target.value && setData(e.target.value)} className={`${campo} font-semibold text-green-700`} />
        {nuvemLigada && (
          <p className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${estadoNuvem === 'ok' ? 'text-sky-700' : estadoNuvem === 'pendente' ? 'text-amber-700' : 'text-gray-400'}`}>
            {estadoNuvem === 'pendente' ? <CloudOff size={14} /> : <Cloud size={14} />}
            {estadoNuvem === 'ok' ? 'Na nuvem — fotos e dados visíveis no sistema' : estadoNuvem === 'pendente' ? 'Sem internet — salvo no aparelho, sobe sozinho depois' : 'Sincronizando…'}
          </p>
        )}
      </div>
      <datalist id="produtos-transf">{nomes.map(n => <option key={n} value={n} />)}</datalist>
      {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{erro}</p>}
      {doDia.length === 0 && <p className="text-center text-gray-400 py-6">Nenhuma transferência neste dia.</p>}

      {doDia.map(t => (
        <div key={t.id} className="bg-white rounded-2xl border border-gray-200 p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧪</span>
            <input list="produtos-transf" value={t.produto} onChange={e => atualizar(t.id, 'produto', e.target.value)} placeholder="Produto (ex.: ACTARA)" className={`${campo} font-bold uppercase`} />
            <button onClick={() => remover(t.id)} aria-label="Remover" className="p-2 text-gray-300 hover:text-red-500"><Trash2 size={18} /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {CAMPOS.map(([c, rot]) => (
              <label key={c} className="block">
                <span className="text-xs font-semibold text-gray-500">{rot}</span>
                <input value={t[c]} onChange={e => atualizar(t.id, c, e.target.value)} className={campo} />
              </label>
            ))}
          </div>
          <CampoFoto rotulo="📷 Foto do produto transferido" valor={fotos[`${t.id}:fotoTransf`]} onChange={v => setFoto(t.id, 'fotoTransf', v)} />
          <label className="block">
            <span className="text-xs font-semibold text-gray-500">Devolução (opcional)</span>
            <input value={t.devolucao} onChange={e => atualizar(t.id, 'devolucao', e.target.value)} placeholder="ex.: 2,9 kg C. Calda 02" className={campo} />
          </label>
          {doDia.length > 1 && (
            <button onClick={() => enviar([comFotos.find(x => x.id === t.id)])} disabled={enviando} className="w-full flex items-center justify-center gap-1.5 border-2 border-green-600 text-green-700 rounded-xl py-2.5 text-sm font-bold"><Send size={15} /> Enviar só este produto</button>
          )}
        </div>
      ))}

      <button onClick={adicionar} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-green-400 text-green-700 rounded-2xl py-4 font-bold"><Plus size={18} /> Adicionar produto</button>

      {doDia.length > 0 && (
        <div className="space-y-2">
          <button onClick={() => enviar()} disabled={enviando} className="w-full flex items-center justify-center gap-2 bg-green-600 active:bg-green-700 disabled:opacity-50 text-white font-bold text-lg rounded-2xl py-4 shadow"><Send size={20} /> {enviando ? 'Preparando…' : 'Enviar no WhatsApp'}</button>
          <button onClick={copiar} className="w-full flex items-center justify-center gap-1.5 bg-white border border-gray-300 rounded-xl py-3 text-sm font-semibold text-gray-700">{copiado ? <Check size={16} className="text-green-600" /> : <Copy size={16} />} {copiado ? 'Copiado' : 'Copiar texto'}</button>
          <p className="text-[11px] text-gray-400 text-center">No celular as fotos vão junto, cada uma com o nome do produto escrito no topo. No computador abre só o texto.</p>
        </div>
      )}
    </div>
  )
}
