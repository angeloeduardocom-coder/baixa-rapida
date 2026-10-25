import { useEffect, useState } from 'react'
import { LogIn, Sprout, Droplets, SprayCan, Eye, ShieldCheck, Check } from 'lucide-react'
import { PERFIS_APP } from '../lib/sessao'
import { supabase } from '../lib/nuvem'

// Senhas trocadas pelo dono no sistema (Configurar permissões › Senhas e logins): config_sistema
// id 'senhas' → app { perfil: senha } e usuarios [{ nome, sistema: 'campo', perfil, senha, ativo }].
// Sem internet usa a última cópia deste aparelho; sem nada, a senha padrão do perfil.
const CHAVE_SENHAS = 'campo:senhas'
const lerSenhas = () => { try { return JSON.parse(localStorage.getItem(CHAVE_SENHAS) || 'null') || {} } catch { return {} } }

const INFO = {
  ferti1: [Sprout, 'Fertirrigação 1 · baixa e transferência'],
  ferti2: [Droplets, 'Fertirrigação 2 · baixa e transferência'],
  pulv: [SprayCan, 'Pulverização · baixa, transferência e pedido'],
  aux: [Eye, 'Ver a programação do dia ao vivo'],
  gestor: [ShieldCheck, 'Vê e edita tudo'],
}

export default function Login({ onEntrar }) {
  const [nome, setNome] = useState('')
  const [perfil, setPerfil] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [senhas, setSenhas] = useState(lerSenhas)
  useEffect(() => {
    supabase?.from('config_sistema').select('dados').eq('id', 'senhas').maybeSingle().then(({ data, error }) => {
      if (error || !data?.dados) return
      setSenhas(data.dados)
      try { localStorage.setItem(CHAVE_SENHAS, JSON.stringify(data.dados)) } catch { /* ok */ }
    })
  }, [])
  async function entrar(e) {
    e.preventDefault()
    const p = PERFIS_APP.find(x => x.id === perfil)
    if (!nome.trim()) return setErro('Digite seu nome.')
    if (!p) return setErro('Escolha o seu campo.')
    const digitada = senha.trim()
    const confere = cfg => {
      // Senha do perfil excluída pelo dono: só entra quem tem login individual.
      const bloqueado = (cfg.bloqueados?.app || []).includes(p.id)
      const doPerfil = (cfg.app?.[p.id] || '').trim() || p.senha
      if (!bloqueado && digitada.toLowerCase() === doPerfil.toLowerCase()) return { ok: true }
      const meus = (cfg.usuarios || []).filter(u => u.ativo !== false && u.sistema === 'campo' && String(u.senha || '').trim() === digitada)
      return meus.some(u => u.perfil === p.id) ? { ok: true } : { ok: false, outro: PERFIS_APP.find(x => x.id === meus[0]?.perfil)?.rotulo }
    }
    let r = confere(senhas)
    if (!r.ok && supabase) {
      // Login criado agora há pouco: busca de novo antes de recusar.
      const { data } = await supabase.from('config_sistema').select('dados').eq('id', 'senhas').maybeSingle()
      if (data?.dados) { setSenhas(data.dados); try { localStorage.setItem(CHAVE_SENHAS, JSON.stringify(data.dados)) } catch { /* ok */ } r = confere(data.dados) }
    }
    if (!r.ok) return setErro(r.outro ? `Essa senha é de um login do perfil ${r.outro}. Escolha esse perfil.` : 'Senha errada.')
    onEntrar({ nome: nome.trim(), perfil: p.id })
  }
  const campo = 'w-full border border-gray-300 focus:border-green-600 focus:ring-2 focus:ring-green-200 rounded-xl px-3 py-3 text-base bg-white outline-none'
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-700 to-green-900 flex items-center justify-center p-4">
      <form onSubmit={entrar} className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-5 space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-green-800">S.P.A Campo</h1>
          <p className="text-sm text-gray-500">Entre com o seu nome e o seu campo</p>
        </div>
        <label className="block">
          <span className="text-xs font-semibold text-gray-500">Seu nome</span>
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: João" className={campo} autoComplete="name" />
        </label>
        <div>
          <span className="text-xs font-semibold text-gray-500">Seu campo</span>
          <div className="mt-1 rounded-2xl border border-gray-200 overflow-hidden divide-y divide-gray-100" role="radiogroup" aria-label="Seu campo">
            {PERFIS_APP.map(p => {
              const [Icone, desc] = INFO[p.id] || [Sprout, '']
              const on = perfil === p.id
              return (
                <button type="button" key={p.id} role="radio" aria-checked={on} onClick={() => { setPerfil(p.id); setErro('') }}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors ${on ? 'bg-green-50' : 'bg-white active:bg-gray-50'}`}>
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${on ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'}`}><Icone size={20} /></span>
                  <span className="flex-1 min-w-0">
                    <span className={`block font-bold leading-tight ${on ? 'text-green-800' : 'text-gray-800'}`}>{p.rotulo}</span>
                    <span className="block text-xs text-gray-500 truncate">{desc}</span>
                  </span>
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${on ? 'border-green-600 bg-green-600' : 'border-gray-300'}`}>{on && <Check size={12} className="text-white" strokeWidth={3} />}</span>
                </button>
              )
            })}
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
