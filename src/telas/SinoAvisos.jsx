import { useEffect, useState } from 'react'
import { Bell, BellRing, Volume2, VolumeX, X } from 'lucide-react'
import { lerAvisos, marcarTodosLidos, somLigado, definirSom, destravarSom, tocarBipe, ativarPush, estadoPush } from '../lib/avisosAoVivo'

// Sino do cabeçalho: lista dos últimos avisos, som liga/desliga e "ativar notificações no
// celular" (push). Também mostra a mensagem flutuante quando chega um aviso.
// Arquivo igual no sistema SPA (src/components/SinoAvisos.jsx).
export default function SinoAvisos({ app, perfil = null, nome = null }) {
  const [avisos, setAvisos] = useState(lerAvisos)
  const [aberto, setAberto] = useState(false)
  const [toast, setToast] = useState(null)
  const [som, setSom] = useState(somLigado)
  const [push, setPush] = useState('...')
  const [erro, setErro] = useState('')
  const [teste, setTeste] = useState('')
  // Mostra uma notificação de teste em 5 s (dá tempo de sair do app) — se não aparecer, o
  // problema é o celular (notificação do Chrome bloqueada / não perturbe), não o servidor.
  async function testar() {
    setTeste('Saia do app agora — a notificação de teste aparece em 5 segundos…')
    try {
      const reg = await navigator.serviceWorker.ready
      setTimeout(() => reg.showNotification('Teste de notificação', { body: 'Se você está vendo isto, as notificações funcionam neste celular.', icon: '/icon-192.png', vibrate: [200, 100, 200], tag: 'teste' }).catch(e => setTeste('Erro: ' + e.message)), 5000)
    } catch (e) { setTeste('Erro: ' + e.message) }
  }
  useEffect(() => {
    let t
    const novo = e => {
      setAvisos(lerAvisos())
      if (e.detail && !e.detail.silencioso) { setToast(e.detail); clearTimeout(t); t = setTimeout(() => setToast(null), 7000) }
    }
    window.addEventListener('avisos:novo', novo)
    // Celular só toca som depois de um toque na tela — destrava no primeiro toque.
    const destravar = () => destravarSom()
    window.addEventListener('pointerdown', destravar, { once: true })
    estadoPush().then(setPush)
    return () => { window.removeEventListener('avisos:novo', novo); clearTimeout(t) }
  }, [])
  const naoLidos = avisos.filter(a => !a.lido).length
  async function ligarPush() {
    setErro('')
    try { await ativarPush({ app, perfil, nome }); setPush('ativo'); tocarBipe() } catch (e) { setErro(e.message) }
  }
  const hora = iso => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  return (
    <>
      <button onClick={() => { setAberto(v => !v); if (!aberto) marcarTodosLidos() }} aria-label="Avisos"
        className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 text-white">
        {naoLidos ? <BellRing size={18} /> : <Bell size={18} />}
        {naoLidos > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{naoLidos > 9 ? '9+' : naoLidos}</span>}
      </button>
      {aberto && (
        <div className="fixed inset-0 z-[70] bg-black/30" onClick={() => setAberto(false)}>
          <div onClick={e => e.stopPropagation()} className="absolute right-2 top-14 w-[min(94vw,380px)] max-h-[75vh] overflow-hidden rounded-2xl bg-white text-gray-800 shadow-2xl flex flex-col">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <b className="flex-1">Avisos</b>
              <button onClick={() => { const n = !som; setSom(n); definirSom(n); if (n) tocarBipe() }} className="flex items-center gap-1 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg px-2 py-1">
                {som ? <><Volume2 size={14} /> Som ligado</> : <><VolumeX size={14} /> Som desligado</>}
              </button>
              <button onClick={() => setAberto(false)} aria-label="Fechar" className="p-1 text-gray-400"><X size={16} /></button>
            </div>
            <div className="px-4 py-3 border-b border-gray-100 bg-green-50 text-sm">
              {push === 'ativo' ? <>
                <p className="text-green-800 font-semibold">✓ Notificações ativas neste celular — chegam mesmo com o app fechado.</p>
                <button onClick={testar} className="mt-2 w-full h-9 rounded-xl border border-green-600 text-green-700 font-bold text-sm">Testar notificação</button>
                {teste && <p className="text-xs text-gray-700 mt-1">{teste}</p>}
              </>
                : push === 'bloqueado' ? <p className="text-red-700">Notificação bloqueada neste navegador. Libere nas configurações do site.</p>
                : push === 'sem-suporte' ? <p className="text-amber-800">Este navegador não aceita notificação com o app fechado. No iPhone, instale o app na tela inicial.</p>
                : <button onClick={ligarPush} className="w-full h-10 rounded-xl bg-green-600 text-white font-bold">Ativar notificações no celular</button>}
              {erro && <p className="text-xs text-red-600 mt-2">{erro}</p>}
            </div>
            <div className="overflow-y-auto">
              {avisos.length === 0 && <p className="text-center text-sm text-gray-400 py-8">Nenhum aviso ainda.</p>}
              {avisos.map(a => (
                <div key={a.id} className="px-4 py-2.5 border-b border-gray-50">
                  <p className="text-sm font-semibold">{a.titulo}</p>
                  {a.corpo && <p className="text-xs text-gray-600">{a.corpo}</p>}
                  <p className="text-[10px] text-gray-400 mt-0.5">{hora(a.em)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div role="status" onClick={() => setToast(null)} className="fixed top-3 left-1/2 -translate-x-1/2 z-[80] w-[min(94vw,420px)] rounded-2xl bg-gray-900 text-white shadow-2xl px-4 py-3 flex items-start gap-3 animate-[surgir_.2s_ease-out]">
          <BellRing size={18} className="shrink-0 mt-0.5 text-green-400" />
          <div className="text-sm"><p className="font-bold">{toast.titulo}</p>{toast.corpo && <p className="text-white/80">{toast.corpo}</p>}</div>
        </div>
      )}
    </>
  )
}
