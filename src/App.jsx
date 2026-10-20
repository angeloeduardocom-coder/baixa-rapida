import { useState } from 'react'
import { ClipboardList, ArrowRightLeft, History } from 'lucide-react'
import Baixa from './telas/Baixa'
import Transferencia from './telas/Transferencia'
import Historico from './telas/Historico'

const ABAS = [
  { id: 'baixa', rotulo: 'Baixa', Icone: ClipboardList },
  { id: 'historico', rotulo: 'Histórico', Icone: History },
  { id: 'transf', rotulo: 'Transferência', Icone: ArrowRightLeft },
]

export default function App() {
  const [aba, setAba] = useState(() => { try { return localStorage.getItem('aba') || 'baixa' } catch { return 'baixa' } })
  const escolher = id => { setAba(id); try { localStorage.setItem('aba', id) } catch { /* ok */ } }
  return (
    <div className="min-h-screen max-w-xl mx-auto">
      <header className="sticky top-0 z-10 bg-green-700 text-white px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] shadow">
        <h1 className="font-bold text-lg leading-tight">{aba === 'baixa' ? 'Baixa de insumos' : aba === 'historico' ? 'Histórico e relatório' : 'Transferência de insumos'}</h1>
        <p className="text-xs text-green-100">Preencha e envie para o WhatsApp</p>
      </header>
      <main className="p-3 pb-[calc(6rem+env(safe-area-inset-bottom))]">
        {aba === 'baixa' ? <Baixa /> : aba === 'historico' ? <Historico /> : <Transferencia />}
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
