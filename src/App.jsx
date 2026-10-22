import { useEffect, useState } from 'react'
import { ClipboardList, ArrowRightLeft, History, LogOut } from 'lucide-react'
import Baixa from './telas/Baixa'
import Transferencia from './telas/Transferencia'
import Historico from './telas/Historico'
import { erroNuvem } from './lib/nuvem'
import Login from './telas/Login'
import { perfilDe } from './lib/sessao'
import { useLocal } from './lib/useLocal'
import SinoAvisos from './telas/SinoAvisos'
import { ligarAvisos } from './lib/avisosNuvem'

const ABAS = [
  { id: 'baixa', rotulo: 'Baixa', Icone: ClipboardList },
  { id: 'historico', rotulo: 'Histórico', Icone: History },
  { id: 'transf', rotulo: 'Transferência', Icone: ArrowRightLeft },
]

export default function App() {
  const [aba, setAba] = useState(() => { try { return localStorage.getItem('aba') || 'baixa' } catch { return 'baixa' } })
  const escolher = id => { setAba(id); try { localStorage.setItem('aba', id) } catch { /* ok */ } }
  const [sessao, setSessao] = useLocal('baixa:sessao', null)
  const perfil = perfilDe(sessao?.perfil)
  // Avisos ao vivo (bipe + mensagem) do que outras pessoas mudam no campo deste perfil.
  useEffect(() => (perfil ? ligarAvisos(perfil, sessao?.nome) : undefined), [perfil, sessao?.nome])
  if (!sessao || !perfil) return <Login onEntrar={setSessao} />
  const sair = () => { if (confirm('Sair deste perfil?')) setSessao(null) }
  return (
    <div className="min-h-screen max-w-xl mx-auto">
      <header className="sticky top-0 z-10 bg-green-700 text-white px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] shadow">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-lg leading-tight">{aba === 'baixa' ? 'Baixa de insumos' : aba === 'historico' ? 'Histórico e relatório' : 'Transferência de insumos'}</h1>
            <p className="text-xs text-green-100 truncate">{perfil.rotulo} · {sessao.nome}</p>
          </div>
          <SinoAvisos app="baixa" perfil={perfil.id} nome={sessao.nome} />
          <button onClick={sair} className="flex items-center gap-1 text-xs font-semibold bg-white/15 rounded-lg px-2.5 py-1.5"><LogOut size={14} /> Sair</button>
        </div>
      </header>
      <main className="p-3 pb-[calc(6rem+env(safe-area-inset-bottom))]">
        {erroNuvem && <p className="mb-3 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{erroNuvem}</p>}
        {aba === 'baixa' ? <Baixa perfil={perfil} nome={sessao.nome} /> : aba === 'historico' ? <Historico perfil={perfil} nome={sessao.nome} /> : <Transferencia perfil={perfil} nome={sessao.nome} />}
      </main>
      <nav className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-gray-200 shadow-2xl pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-xl mx-auto grid grid-cols-3">
          {ABAS.map(({ id, rotulo, Icone }) => (
            <button key={id} onClick={() => escolher(id)} className={`flex flex-col items-center gap-0.5 py-2.5 text-sm font-bold ${aba === id ? 'text-green-700' : 'text-gray-400'}`}>
              <Icone size={22} />
              {rotulo}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
