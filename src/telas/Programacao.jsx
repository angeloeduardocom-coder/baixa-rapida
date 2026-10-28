import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw, Radio } from 'lucide-react'
import { hojeISO, dataBR } from '../lib/useLocal'
import { meuAparelho } from '../lib/nuvem'

// Programação do dia só para ver (Auxiliar; aplicador vê só o método dele via &metodo=): a MESMA requisição do sistema, em modo leitura.
// Atualiza sozinha em tempo real — quando o Programador muda algo no sistema, aparece aqui.
const SISTEMA = (import.meta.env.VITE_URL_SISTEMA || 'https://robo-agr-cola.vercel.app').replace(/\/+$/, '')
const somar = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

export default function Programacao({ perfil, nome }) {
  // Lápis de edição só pra Pulverização e Gestor; Auxiliar só vê.
  const podeEditar = perfil?.id === 'pulv' || perfil?.id === 'gestor'
  const [data, setData] = useState(hojeISO())
  const [altura, setAltura] = useState(600)
  const [versao, setVersao] = useState(0)
  const online = typeof navigator === 'undefined' || navigator.onLine
  useEffect(() => {
    const receber = e => {
      if (e.origin !== SISTEMA || e.data?.tipo !== 'altura-requisicao') return
      setAltura(Math.max(200, Math.min(8000, Number(e.data.altura) + 8)))
    }
    window.addEventListener('message', receber)
    return () => window.removeEventListener('message', receber)
  }, [])
  const campo = 'p-2.5 rounded-xl border border-gray-200 bg-white text-gray-600'
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={() => setData(d => somar(d, -1))} aria-label="Dia anterior" className={campo}><ChevronLeft size={18} /></button>
        <input type="date" value={data} onChange={e => e.target.value && setData(e.target.value)} className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2.5 font-semibold text-green-700 bg-white" />
        <button onClick={() => setData(d => somar(d, 1))} aria-label="Próximo dia" className={campo}><ChevronRight size={18} /></button>
      </div>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-green-700"><Radio size={14} /> Ao vivo · {perfil?.metodo ? `${perfil.metodo} · ` : ''}programação de {dataBR(data)} · {podeEditar ? 'toque no lápis para editar um balde' : 'só visualização'}</p>
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {!online ? <p className="text-sm text-amber-700 bg-amber-50 px-3 py-3">Sem internet: a programação aparece quando o sinal voltar.</p> : (
          <>
            <iframe key={`${data}-${versao}`} title="Programação do dia" src={`${SISTEMA}/app-requisicao?programacao=1&embed=1&data=${data}${perfil?.metodo ? `&metodo=${encodeURIComponent(perfil.metodo)}` : ''}${podeEditar ? `&editar=1&autor=${encodeURIComponent(nome || '')}&aparelho=${encodeURIComponent(meuAparelho)}` : ''}`} style={{ height: altura }} className="w-full block border-0" />
            <button onClick={() => setVersao(v => v + 1)} className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-gray-500 border-t border-gray-100"><RefreshCw size={13} /> Recarregar</button>
          </>
        )}
      </div>
    </div>
  )
}
