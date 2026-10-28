import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw, Radio, CalendarDays, ClipboardList, ClipboardCheck, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import AnotacoesDia from './AnotacoesDia'
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
  // Aplicador (ex.: Drone): duas abas — a programação do método (com anotações) e a requisição dele.
  const aplicador = !!perfil?.metodo
  const [aba, setAba] = useState(() => { try { return (aplicador && localStorage.getItem('apl:aba')) || 'prog' } catch { return 'prog' } })
  const trocarAba = a => { setAba(a); setAltura(600); try { localStorage.setItem('apl:aba', a) } catch { /* ok */ } }
  const srcRequisicao = `${SISTEMA}/app-requisicao?embed=1&data=${data}&metodo=${encodeURIComponent(perfil?.metodo || '')}&avisar=gestor&aparelho=${encodeURIComponent(meuAparelho)}&autor=${encodeURIComponent(nome ? `${nome} (app)` : 'App Campo')}`
  const srcBaixa = `${SISTEMA}/app-requisicao?baixatrator=1&embed=1&data=${data}&metodo=${encodeURIComponent(perfil?.metodo || '')}&aparelho=${encodeURIComponent(meuAparelho)}&autor=${encodeURIComponent(nome || '')}`
  const srcFolha = `${SISTEMA}/app-requisicao?folhabaixas=1&data=${data}&metodo=Tratorizado`
  const [folhaAberta, setFolhaAberta] = useState(false)
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
      {aplicador && (
        <div className={`grid ${perfil?.baixa ? 'grid-cols-3' : 'grid-cols-2'} bg-gray-100 rounded-xl p-1`}>
          {[['prog', 'Programação', CalendarDays], ['req', 'Requisição', ClipboardList], ...(perfil?.baixa ? [['baixa', 'Baixa', ClipboardCheck]] : [])].map(([id, rot, Icone]) => (
            <button key={id} onClick={() => trocarAba(id)} className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold ${aba === id ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500'}`}><Icone size={16} /> {rot}</button>
          ))}
        </div>
      )}
      <p className="flex items-center gap-1.5 text-xs font-semibold text-green-700"><Radio size={14} /> Ao vivo · {perfil?.metodo ? `${perfil.metodo} · ` : ''}programação de {dataBR(data)} · {aplicador && aba === 'baixa' ? 'baixa do balde — iniciar e finalizar a aplicação' : aplicador && aba === 'req' ? 'requisição — salvar avisa o Gestor' : aplicador ? 'toque em "Não aplicado" se algo não foi feito' : podeEditar ? 'toque no lápis para editar um balde' : 'só visualização'}</p>
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {!online ? <p className="text-sm text-amber-700 bg-amber-50 px-3 py-3">Sem internet: a programação aparece quando o sinal voltar.</p> : (
          <>
            <iframe key={`${aba}-${data}-${versao}`} title={aplicador && aba === 'baixa' ? 'Baixa' : aplicador && aba === 'req' ? 'Requisição' : 'Programação do dia'} src={aplicador && aba === 'baixa' ? srcBaixa : aplicador && aba === 'req' ? srcRequisicao : `${SISTEMA}/app-requisicao?programacao=1&embed=1&data=${data}${perfil?.metodo ? `&metodo=${encodeURIComponent(perfil.metodo)}&naoaplicado=1&autor=${encodeURIComponent(nome || '')}&aparelho=${encodeURIComponent(meuAparelho)}` : ''}${podeEditar ? `&editar=1&autor=${encodeURIComponent(nome || '')}&aparelho=${encodeURIComponent(meuAparelho)}` : ''}`} style={{ height: altura }} className="w-full block border-0" />
            <button onClick={() => setVersao(v => v + 1)} className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-gray-500 border-t border-gray-100"><RefreshCw size={13} /> Recarregar</button>
          </>
        )}
      </div>
      {(!aplicador || aba === 'prog') && <AnotacoesDia data={data} perfil={perfil} nome={nome} />}
      {perfil?.id === 'gestor' && online && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-3">
            <button onClick={() => setFolhaAberta(a => !a)} className="flex-1 flex items-center gap-2 text-left"><ClipboardCheck size={18} className="text-green-700" /><span className="flex-1 font-bold text-gray-800">Folha de baixas · Tratorizado</span>{folhaAberta ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}</button>
            <a href={srcFolha} target="_blank" rel="noreferrer" aria-label="Abrir a folha para imprimir" className="p-1.5 text-gray-400"><ExternalLink size={16} /></a>
          </div>
          {folhaAberta && <iframe key={`folha-${data}-${versao}`} title="Folha de baixas" src={`${srcFolha}&embed=1`} style={{ height: 560 }} className="w-full block border-0 border-t border-gray-100" />}
        </div>
      )}
    </div>
  )
}
