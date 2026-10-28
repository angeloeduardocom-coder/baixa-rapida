import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, X, Send, Copy, Check, Camera, ImagePlus, Cloud, CloudOff, PackageSearch, Save } from 'lucide-react'
import { PRODUTOS } from '../data/produtos'
import { useLocal, uid, hojeISO, diaMes } from '../lib/useLocal'
import { comprimirImagem, carimbarFoto, salvarFotoLocal, lerFotosLocais } from '../lib/fotos'
import { textoTransferencias, abrirWhatsapp } from '../lib/textos'
import { publicarAviso, perfisDoTipo, mudouDesdeUltimoAviso, lembrarAviso } from '../lib/avisosNuvem'
import { transfVisivel } from '../lib/sessao'
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

const SISTEMA = (import.meta.env.VITE_URL_SISTEMA || 'https://robo-agr-cola.vercel.app').replace(/\/+$/, '')

// Fluxo da transferência: 'fechado' (estoque fechado → aberto, o modelo de sempre, com saldo
// anterior) ou 'aberto' (de um estoque aberto pra outro, com foto da saída e da chegada).
// Itens antigos sem `fluxo` são do fechado.
export const fluxoDe = t => t.fluxo || 'fechado'
const FOTOS = { fechado: [['fotoTransf', '📷 Foto do produto transferido', 'TRANSFERÊNCIA']], aberto: [['fotoTransf', '📷 Foto na saída', 'SAÍDA'], ['fotoChegada', '📷 Foto na chegada', 'CHEGADA']] }
const CAMPOS_ABERTO = [['qtdeTransf', '📦 Quantidade'], ['estoque', '🏠 Saiu de (estoque)'], ['destino', '🏠 Foi para']]

const CAMPOS = [['saldoAnt', '📊 Saldo ant.'], ['qtdeTransf', '📦 Qtde transf.'], ['estoque', '🏠 Estoque'], ['destino', '🏠 Destino']]

export default function Transferencia({ perfil, nome, fluxo = 'fechado' }) {
  const fotosDo = t => FOTOS[fluxoDe(t)] || FOTOS.fechado
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
        for (const [c] of fotosDo(t)) {
          const src = fotosRef.current[`${t.id}:${c}`]
          if (src && !t[`${c}Url`] && src.startsWith('data:')) {
            const url = await enviarFoto(`${t.id}-${c}`, src)
            local = local.map(x => (x.id === t.id ? { ...x, [`${c}Url`]: url } : x))
          }
        }
      }
      // 2) Junta com a nuvem e grava.
      const junta = await sincronizarTransferencias(local, apagados)
      ultimoEnvio.current = JSON.stringify(junta)
      setLista(cur => {
        if (cur === inicio) return junta
        // Mexeram durante a sincronização: mantém o que foi digitado, só põe os endereços das
        // fotos e os itens novos da nuvem (a próxima sincronização sobe o resto).
        const porId = new Map(local.map(x => [x.id, x]))
        const ids = new Set(cur.map(x => x.id))
        const comUrls = x => {
          const l = porId.get(x.id); if (!l) return x
          let y = x
          for (const c of ['fotoTransf', 'fotoChegada']) if (l[`${c}Url`] && !x[`${c}Url`] && x[`${c}Url`] !== null) y = { ...y, [`${c}Url`]: l[`${c}Url`] }
          return y
        }
        return [...cur.map(comUrls), ...junta.filter(x => !ids.has(x.id) && !inicio.some(i => i.id === x.id))]
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
      for (const [c] of fotosDo(t)) {
        const k = `${t.id}:${c}`
        if (t.data === data && t[`${c}Url`] && !fotos[k]) {
          baixarFoto(t[`${c}Url`]).then(src => setFotos(f => (f[k] ? f : { ...f, [k]: src }))).catch(() => {})
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, lista])

  const doDia = lista.filter(t => t.data === data && transfVisivel(t, perfil) && fluxoDe(t) === fluxo)
  const comFotos = doDia.map(t => ({ ...t, temFotoTransf: !!fotos[`${t.id}:fotoTransf`], temFotoChegada: !!fotos[`${t.id}:fotoChegada`], temFotoDevolucao: false }))
  const nomes = useMemo(() => PRODUTOS.map(p => p.nome), [])

  // ---------- Pedido do fechado ----------
  // Pergunta ao sistema (página escondida) o que a programação de pulverização do dia usa e o
  // estoque aberto não cobre, e já cria os produtos aqui com o saldo anterior e a quantidade.
  const [pedido, setPedido] = useState({ estado: 'parado', msg: '', ultimo: null, chave: 0 })
  const dataPedido = useRef(data); dataPedido.current = data
  useEffect(() => {
    const receber = e => {
      if (e.origin !== SISTEMA || e.data?.tipo !== 'pedido-fechado' || e.data.data !== dataPedido.current) return
      const todos = e.data.itens || []
      if (e.data.semProgramacao) { setPedido(p => ({ ...p, estado: 'aviso', msg: 'Ainda não tem programação de pulverização nesse dia.', ultimo: null })); return }
      incluirPedido(todos.filter(i => i.situacao === 'pedir' || i.situacao === 'falta'), todos)
    }
    window.addEventListener('message', receber)
    return () => window.removeEventListener('message', receber)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (pedido.estado !== 'buscando') return
    const t = setTimeout(() => setPedido(p => (p.estado === 'buscando' ? { ...p, estado: 'aviso', msg: 'O sistema não respondeu. Confira a internet e tente de novo.' } : p)), 25000)
    return () => clearTimeout(t)
  }, [pedido.estado, pedido.chave])
  function pedirDoFechado() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { setPedido(p => ({ ...p, estado: 'aviso', msg: 'Sem internet: o pedido precisa do sistema.' })); return }
    setPedido(p => ({ ...p, estado: 'buscando', msg: '', chave: p.chave + 1 }))
  }
  function incluirPedido(itens, todos) {
    const ja = new Set(listaRef.current.filter(t => t.data === dataPedido.current).map(t => String(t.produto || '').trim().toUpperCase()))
    const novos = itens.filter(i => !ja.has(String(i.produto).trim().toUpperCase()))
    if (novos.length) {
      setLista(l => [...l, ...novos.map(i => ({ id: uid(), data: dataPedido.current, tipo: 'pulv', autor: nome || null, produto: i.produto, saldoAnt: i.saldoAnt, qtdeTransf: i.qtdeSugerida, estoque: '', destino: '', devolucao: '' }))])
    }
    const msg = !itens.length ? 'Nada a pedir do fechado: o estoque aberto cobre a programação.' : novos.length ? `${novos.length} produto(s) listado(s). Confira a quantidade e preencha estoque e destino.` : 'Esses produtos já estão na lista do dia.'
    setPedido(p => ({ ...p, estado: 'aviso', msg, ultimo: todos }))
  }

  const adicionar = () => setLista(l => [...l, { id: uid(), data, tipo: perfil?.tipos?.length === 1 ? perfil.tipos[0] : null, autor: nome || null, produto: '', saldoAnt: '', qtdeTransf: '', estoque: '', destino: '', devolucao: '', fluxo }])
  const atualizar = (id, c, v) => setLista(l => l.map(t => (t.id === id ? { ...t, [c]: v } : t)))
  function remover(id) {
    ;['fotoTransf', 'fotoChegada', 'fotoDevolucao'].forEach(c => salvarFotoLocal(`${id}:${c}`, '').catch(() => {}))
    setFotos(f => { const n = { ...f }; delete n[`${id}:fotoTransf`]; delete n[`${id}:fotoChegada`]; delete n[`${id}:fotoDevolucao`]; return n })
    setLista(l => l.filter(t => t.id !== id))
    setApagados(a => (a.includes(id) ? a : [...a, id]))
  }
  function setFoto(id, c, valor) {
    const chave = `${id}:${c}`
    setFotos(f => { const n = { ...f }; if (valor) n[chave] = valor; else delete n[chave]; return n })
    salvarFotoLocal(chave, valor).then(() => setErro('')).catch(() => setErro('Não consegui guardar a foto neste aparelho.'))
    // Foto trocada ou removida: a da nuvem deixa de valer (a nova sobe na próxima sincronização).
    if (c === 'fotoTransf' || c === 'fotoChegada') atualizar(id, `${c}Url`, null)
  }

  async function arquivosFotos(itens) {
    const arqs = []
    for (let i = 0; i < itens.length; i++) {
      const t = itens[i]
      const nome = (t.produto || `PRODUTO ${i + 1}`).toUpperCase()
      const base = nome.replace(/[^\w-]+/g, '_')
      // Uma foto só por produto (a do produto transferido) — a da devolução saiu, era a mesma.
      for (const [campo_, , rot] of fotosDo(t)) {
        const src = fotos[`${t.id}:${campo_}`]
        if (src) arqs.push(new File([await carimbarFoto(src, `${nome} — ${rot} · ${diaMes(data)}`)], `${i + 1}_${base}_${rot.toLowerCase()}.jpg`, { type: 'image/jpeg' }))
      }
    }
    return arqs
  }

  // Salvar: sobe pra nuvem na hora e avisa os outros (só aqui e no Enviar — digitar não avisa).
  const [salvoMsg, setSalvoMsg] = useState('')
  async function salvarEAvisar(itens = comFotos) {
    const validos = itens.filter(t => String(t.produto || '').trim())
    if (!validos.length) return
    await sincronizar()
    const perfis = [...new Set(validos.flatMap(t => perfisDoTipo(t.tipo ?? null)))]
    const tagAviso = `transf:${fluxo}:${data}`
    // Nada mudou desde o último aviso: salva, mas não notifica ninguém.
    if (!mudouDesdeUltimoAviso(tagAviso, validos)) {
      setSalvoMsg(`Salvo às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — sem mudança, ninguém foi avisado`)
      setTimeout(() => setSalvoMsg(''), 4000)
      return
    }
    const ok = await publicarAviso({
      perfis,
      titulo: fluxo === 'aberto' ? 'Transferência aberto → aberto salva' : 'Transferência fechado → aberto salva',
      corpo: `${nome || 'Alguém'}: ${validos.map(t => String(t.produto).toUpperCase()).join(', ').slice(0, 120)} · ${diaMes(data)}`,
      tag: tagAviso,
      autor: nome || null,
    })
    if (ok) lembrarAviso(tagAviso, validos)
    setSalvoMsg(ok ? `Salvo às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — os outros foram avisados` : 'Salvo no aparelho. Sobe e avisa quando tiver internet.')
    setTimeout(() => setSalvoMsg(''), 4000)
  }

  async function enviar(itens = comFotos) {
    if (enviando || !itens.length) return
    salvarEAvisar(itens)
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
        <p className="text-sm font-bold text-gray-700 mb-2">{fluxo === 'aberto' ? 'Transferência de aberto para aberto' : 'Fechado → aberto · saldo anterior e transferências'}</p>
        <input type="date" value={data} onChange={e => e.target.value && setData(e.target.value)} className={`${campo} font-semibold text-green-700`} />
        {nuvemLigada && (
          <p className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${estadoNuvem === 'ok' ? 'text-sky-700' : estadoNuvem === 'pendente' ? 'text-amber-700' : 'text-gray-400'}`}>
            {estadoNuvem === 'pendente' ? <CloudOff size={14} /> : <Cloud size={14} />}
            {estadoNuvem === 'ok' ? 'Na nuvem — fotos e dados visíveis no sistema' : estadoNuvem === 'pendente' ? 'Sem internet — salvo no aparelho, sobe sozinho depois' : 'Sincronizando…'}
          </p>
        )}
      </div>
      {fluxo === 'fechado' && (perfil?.tipos || []).includes('pulv') && (
        <div className="bg-white rounded-2xl border border-gray-200 p-3 space-y-2">
          <button onClick={pedirDoFechado} disabled={pedido.estado === 'buscando'} className="w-full flex items-center justify-center gap-2 bg-amber-500 active:bg-amber-600 disabled:opacity-60 text-white font-bold rounded-xl py-3"><PackageSearch size={18} /> {pedido.estado === 'buscando' ? 'Buscando a programação…' : 'Pedido do fechado'}</button>
          {pedido.estado === 'buscando' && <iframe key={pedido.chave} title="Pedido do fechado" src={`${SISTEMA}/app-requisicao?pedido=1&embed=1&data=${data}`} style={{ display: 'none' }} />}
          {pedido.estado === 'aviso' && <p className="text-xs text-gray-600">{pedido.msg}</p>}
          {pedido.estado === 'aviso' && pedido.ultimo?.length > 0 && (
            <button onClick={() => incluirPedido(pedido.ultimo, pedido.ultimo)} className="text-xs font-semibold text-amber-700 underline">Listar todos os produtos da programação</button>
          )}
        </div>
      )}
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
            {(fluxo === 'aberto' ? CAMPOS_ABERTO : CAMPOS).map(([c, rot]) => (
              <label key={c} className="block">
                <span className="text-xs font-semibold text-gray-500">{rot}</span>
                <input value={t[c]} onChange={e => atualizar(t.id, c, e.target.value)} className={campo} />
              </label>
            ))}
          </div>
          {fotosDo(t).map(([c, rot]) => <CampoFoto key={c} rotulo={rot} valor={fotos[`${t.id}:${c}`]} onChange={v => setFoto(t.id, c, v)} />)}
          {fluxo === 'fechado' && (
          <label className="block">
            <span className="text-xs font-semibold text-gray-500">Devolução (opcional)</span>
            <input value={t.devolucao} onChange={e => atualizar(t.id, 'devolucao', e.target.value)} placeholder="ex.: 2,9 kg C. Calda 02" className={campo} />
          </label>
          )}
          {doDia.length > 1 && (
            <button onClick={() => enviar([comFotos.find(x => x.id === t.id)])} disabled={enviando} className="w-full flex items-center justify-center gap-1.5 border-2 border-green-600 text-green-700 rounded-xl py-2.5 text-sm font-bold"><Send size={15} /> Enviar só este produto</button>
          )}
        </div>
      ))}

      <button onClick={adicionar} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-green-400 text-green-700 rounded-2xl py-4 font-bold"><Plus size={18} /> Adicionar produto</button>

      {doDia.length > 0 && (
        <div className="space-y-2">
          <button onClick={() => salvarEAvisar()} className="w-full flex items-center justify-center gap-2 bg-white border-2 border-green-600 text-green-700 active:bg-green-50 font-bold text-lg rounded-2xl py-3.5"><Save size={20} /> Salvar</button>
          {salvoMsg && <p className="text-center text-xs font-semibold text-green-700">{salvoMsg}</p>}
          <button onClick={() => enviar()} disabled={enviando} className="w-full flex items-center justify-center gap-2 bg-green-600 active:bg-green-700 disabled:opacity-50 text-white font-bold text-lg rounded-2xl py-4 shadow"><Send size={20} /> {enviando ? 'Preparando…' : 'Enviar no WhatsApp'}</button>
          <button onClick={copiar} className="w-full flex items-center justify-center gap-1.5 bg-white border border-gray-300 rounded-xl py-3 text-sm font-semibold text-gray-700">{copiado ? <Check size={16} className="text-green-600" /> : <Copy size={16} />} {copiado ? 'Copiado' : 'Copiar texto'}</button>
          <p className="text-[11px] text-gray-400 text-center">No celular as fotos vão junto, cada uma com o nome do produto escrito no topo. No computador abre só o texto.</p>
        </div>
      )}
    </div>
  )
}
