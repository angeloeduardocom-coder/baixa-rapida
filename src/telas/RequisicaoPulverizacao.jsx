import { useEffect, useState } from 'react'
import { ClipboardList, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'

// Requisição de Pulverização do dia — a MESMA Folha que o Caldeiro vê no sistema, com as mesmas
// edições (grava no sistema na hora). Vem da página /app-requisicao do sistema, num quadro.
// Aparece sozinha quando a programação do dia é feita. Precisa de internet.
const SISTEMA = (import.meta.env.VITE_URL_SISTEMA || 'https://robo-agr-cola.vercel.app').replace(/\/+$/, '')

export default function RequisicaoPulverizacao({ data, autor }) {
  const [aberta, setAberta] = useState(() => { try { return localStorage.getItem('req:aberta') !== '0' } catch { return true } })
  const [altura, setAltura] = useState(600)
  const [versao, setVersao] = useState(0)
  const online = typeof navigator === 'undefined' || navigator.onLine

  useEffect(() => {
    const receber = e => {
      if (e.origin !== SISTEMA || e.data?.tipo !== 'altura-requisicao') return
      setAltura(Math.max(200, Math.min(6000, Number(e.data.altura) + 8)))
    }
    window.addEventListener('message', receber)
    return () => window.removeEventListener('message', receber)
  }, [])
  const alternar = () => setAberta(a => { try { localStorage.setItem('req:aberta', a ? '0' : '1') } catch { /* ok */ } return !a })

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <button onClick={alternar} className="w-full flex items-center gap-2 px-3 py-3 text-left">
        <ClipboardList size={18} className="text-green-700" />
        <span className="flex-1 font-bold text-gray-800">Requisição do dia</span>
        {aberta ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>
      {aberta && (
        <div className="border-t border-gray-100">
          {!online ? (
            <p className="text-sm text-amber-700 bg-amber-50 px-3 py-3">Sem internet: a requisição aparece quando o sinal voltar.</p>
          ) : (
            <>
              <iframe
                key={`${data}-${versao}`}
                title="Requisição do dia"
                src={`${SISTEMA}/app-requisicao?embed=1&data=${data}&autor=${encodeURIComponent(autor ? `${autor} (app)` : 'App Baixa Rápida')}`}
                style={{ height: altura }}
                className="w-full block border-0"
              />
              <button onClick={() => setVersao(v => v + 1)} className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-gray-500 border-t border-gray-100">
                <RefreshCw size={13} /> Atualizar requisição
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
