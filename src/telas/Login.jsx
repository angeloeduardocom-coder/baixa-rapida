import { useState } from 'react'
import { LogIn } from 'lucide-react'
import { PERFIS_APP } from '../lib/sessao'

export default function Login({ onEntrar }) {
  const [nome, setNome] = useState('')
  const [perfil, setPerfil] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  function entrar(e) {
    e.preventDefault()
    const p = PERFIS_APP.find(x => x.id === perfil)
    if (!nome.trim()) return setErro('Digite seu nome.')
    if (!p) return setErro('Escolha o seu campo.')
    if (senha.trim().toLowerCase() !== p.senha) return setErro('Senha errada.')
    onEntrar({ nome: nome.trim(), perfil: p.id })
  }
  const campo = 'w-full border border-gray-300 focus:border-green-600 focus:ring-2 focus:ring-green-200 rounded-xl px-3 py-3 text-base bg-white outline-none'
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-700 to-green-900 flex items-center justify-center p-4">
      <form onSubmit={entrar} className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-5 space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-green-800">Baixa de insumos</h1>
          <p className="text-sm text-gray-500">Entre para lançar a sua baixa</p>
        </div>
        <label className="block">
          <span className="text-xs font-semibold text-gray-500">Seu nome</span>
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: João" className={campo} autoComplete="name" />
        </label>
        <div>
          <span className="text-xs font-semibold text-gray-500">Seu campo</span>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {PERFIS_APP.map(p => (
              <button type="button" key={p.id} onClick={() => setPerfil(p.id)}
                className={`py-3 px-2 rounded-xl font-bold text-sm border-2 ${perfil === p.id ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-600'} ${p.id === 'gestor' || p.id === 'pulv' ? 'col-span-2' : ''}`}>
                {p.rotulo}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="text-xs font-semibold text-gray-500">Senha</span>
          <input type="password" value={senha} onChange={e => setSenha(e.target.value)} className={campo} autoComplete="current-password" />
        </label>
        {erro && <p className="text-sm font-semibold text-red-600 text-center">{erro}</p>}
        <button className="w-full flex items-center justify-center gap-2 bg-green-600 active:bg-green-700 text-white font-bold text-lg rounded-2xl py-3.5"><LogIn size={20} /> Entrar</button>
        <p className="text-[11px] text-gray-400 text-center">© {new Date().getFullYear()} Ângelo Eduardo. Todos os direitos reservados.</p>
      </form>
    </div>
  )
}
