import { useEffect, useState } from 'react'
import { ClipboardList, ArrowRightLeft, History, LogOut, ChevronLeft, Tractor, Sprout, PackageOpen } from 'lucide-react'
import Baixa from './telas/Baixa'
import Transferencia from './telas/Transferencia'
import Historico from './telas/Historico'
import Programacao from './telas/Programacao'
import { erroNuvem } from './lib/nuvem'
import Login from './telas/Login'
import { perfilDe } from './lib/sessao'
import { useLocal } from './lib/useLocal'
import SinoAvisos from './telas/SinoAvisos'
import { ligarAvisos } from './lib/avisosNuvem'

const ABAS = [
  { id: 'baixa', rotulo: 'Baixa', Icone: ClipboardList },
  { id: 'historico', rotulo: 'Histórico', Icone: History },
]

// Menu inicial. Cada botão abre uma tela; a seta do topo volta pra cá.
const TELAS = {
  baixa: { titulo: 'Baixas', desc: 'Lançar a baixa de insumos do dia e ver o histórico e relatório', Icone: ClipboardList, cor: 'bg-green-600' },
  fechado: { titulo: 'Transferência fechado → aberto', desc: 'Pedido do estoque fechado com saldo anterior, quantidade e foto', Icone: PackageOpen, cor: 'bg-amber-500' },
  aberto: { titulo: 'Transferência aberto → aberto', desc: 'Passar produto de um estoque aberto para outro, com foto da saída e da chegada', Icone: ArrowRightLeft, cor: 'bg-sky-600' },
  campo: { titulo: 'Programação do dia', desc: 'Baldes, parcelas e produtos do dia, ao vivo', Icone: Tractor, cor: 'bg-blue-700' },
}

function Inicio({ nome, onEscolher }) {
  return (
    <div className="pt-3 space-y-3">
      <div className="flex items-center gap-2 text-green-800"><Sprout size={20} /><p className="font-bold">O que você vai fazer agora{nome ? `, ${nome.split(' ')[0]}` : ''}?</p></div>
      {Object.entries(TELAS).map(([id, { Icone, titulo, desc, cor }]) => (
        <button key={id} onClick={() => onEscolher(id)} className="w-full flex items-center gap-4 bg-white border-2 border-gray-200 active:border-green-600 active:bg-green-50 rounded-3xl p-4 text-left shadow-sm">
          <span className={`w-14 h-14 rounded-2xl ${cor} text-white flex items-center justify-center shrink-0`}><Icone size={28} /></span>
          <span className="flex-1 min-w-0">
            <span className="block text-[17px] font-extrabold text-gray-800 leading-tight">{titulo}</span>
            <span className="block text-sm text-gray-500 mt-0.5">{desc}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

export default function App() {
  const [aba, setAba] = useState(() => { try { return localStorage.getItem('aba') === 'historico' ? 'historico' : 'baixa' } catch { return 'baixa' } })
  const escolher = id => { setAba(id); try { localStorage.setItem('aba', id) } catch { /* ok */ } }
  // Primeira tela ao abrir: o menu (Baixas, as duas transferências e Programação do dia).
  const [tela, setTela] = useState('inicio')
  const [sessao, setSessao] = useLocal('baixa:sessao', null)
  const perfil = perfilDe(sessao?.perfil)
  // Avisos ao vivo (bipe + mensagem) do que outras pessoas mudam no campo deste perfil.
  useEffect(() => (perfil ? ligarAvisos(perfil, sessao?.nome) : undefined), [perfil, sessao?.nome])
  if (!sessao || !perfil) return <Login onEntrar={setSessao} />
  const soVer = !!perfil.somenteProgramacao
  const sairParaInicio = () => setTela('inicio')
  const sair = () => { if (confirm('Sair deste perfil?')) setSessao(null) }
  return (
    <div className="min-h-screen max-w-xl mx-auto">
      <header className="sticky top-0 z-10 bg-green-700 text-white px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] shadow">
        <div className="flex items-center gap-2">
          {tela !== 'inicio' && !soVer && <button onClick={sairParaInicio} aria-label="Voltar ao início" className="bg-white/15 rounded-lg p-1.5"><ChevronLeft size={18} /></button>}
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-lg leading-tight">{perfil.metodo ? `Aplicação · ${perfil.metodo}` : soVer ? 'Programação do dia' : tela === 'inicio' ? 'S.P.A Campo' : tela === 'baixa' ? (aba === 'historico' ? 'Histórico e relatório' : 'Baixa de insumos') : TELAS[tela]?.titulo}</h1>
            <p className="text-xs text-green-100 truncate">{perfil.rotulo} · {sessao.nome}</p>
          </div>
          <SinoAvisos app="baixa" perfil={perfil.id} nome={sessao.nome} />
          <button onClick={sair} className="flex items-center gap-1 text-xs font-semibold bg-white/15 rounded-lg px-2.5 py-1.5"><LogOut size={14} /> Sair</button>
        </div>
      </header>
      <main className="p-3 pb-[calc(6rem+env(safe-area-inset-bottom))]">
        {erroNuvem && <p className="mb-3 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{erroNuvem}</p>}
        {soVer || tela === 'campo' ? <Programacao perfil={perfil} nome={sessao.nome} />
          : tela === 'inicio' ? <Inicio nome={sessao.nome} onEscolher={setTela} />
          : tela === 'fechado' || tela === 'aberto' ? <Transferencia key={tela} fluxo={tela} perfil={perfil} nome={sessao.nome} />
          : aba === 'historico' ? <Historico perfil={perfil} nome={sessao.nome} /> : <Baixa perfil={perfil} nome={sessao.nome} />}
      </main>
      {!soVer && tela === 'baixa' && <nav className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-gray-200 shadow-2xl pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-xl mx-auto grid grid-cols-2">
          {ABAS.map(({ id, rotulo, Icone }) => (
            <button key={id} onClick={() => escolher(id)} className={`flex flex-col items-center gap-0.5 py-2.5 text-sm font-bold ${aba === id ? 'text-green-700' : 'text-gray-400'}`}>
              <Icone size={22} />
              {rotulo}
            </button>
          ))}
        </div>
      </nav>}
    </div>
  )
}
