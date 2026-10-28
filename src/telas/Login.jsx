import { useEffect, useState } from 'react'
import { LogIn, Sprout, Droplets, SprayCan, Eye, ShieldCheck, Tractor, Plane, Backpack, Droplet, Crosshair, Wind, ChevronLeft, ChevronRight } from 'lucide-react'
import { PERFIS_APP, GRUPOS_APP } from '../lib/sessao'
import { supabase } from '../lib/nuvem'

// Senhas trocadas pelo dono no sistema (Configurar permissões › Senhas e logins): config_sistema
// id 'senhas' → app { perfil: senha } e usuarios [{ nome, sistema: 'campo', perfil, senha, ativo }].
// Sem internet usa a última cópia deste aparelho; sem nada, a senha padrão do perfil.
const CHAVE_SENHAS = 'campo:senhas'
const lerSenhas = () => { try { return JSON.parse(localStorage.getItem(CHAVE_SENHAS) || 'null') || {} } catch { return {} } }

const INFO = {
  ferti1: [Sprout, 'Fertirrigação 1 · baixa e transferência'],
  ferti2: [Droplets, 'Fertirrigação 2 · baixa e transferência'],
  pulv: [SprayCan, 'Pulverização · pedidos, requisições e baixas'],
  aux: [Eye, 'Ver a programação do dia ao vivo'],
  gestor: [ShieldCheck, 'Vê e edita tudo'],
  apl_tratorizado: [Tractor, 'Aplicação com trator'],
  apl_drone: [Plane, 'Aplicação com drone'],
  apl_costal: [Backpack, 'Aplicação com pulverizador costal'],
  apl_esquicho: [Droplet, 'Aplicação com esquicho'],
  apl_lanca: [Crosshair, 'Aplicação com lança'],
  apl_polvilhado: [Wind, 'Aplicação polvilhada'],
}

export default function Login({ onEntrar }) {
  const [nome, setNome] = useState('')
  const [perfil, setPerfil] = useState('')
  const [grupo, setGrupo] = useState(null) // null = tela inicial · id do grupo escolhido
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
  const ICONE_GRUPO = { gestor: ShieldCheck, aux: Eye, aplicacoes: Tractor }
  const g = GRUPOS_APP.find(x => x.id === grupo)
  const escolherGrupo = x => { setErro(''); setGrupo(x.id); setPerfil(x.perfis.length === 1 ? x.perfis[0] : '') }
  const voltar = () => { setErro(''); setSenha(''); if (perfil && g?.perfis.length > 1) setPerfil(''); else { setGrupo(null); setPerfil('') } }
  const Linha = ({ Icone, titulo, desc, onClick }) => (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-3 px-3.5 py-3.5 text-left bg-white active:bg-green-50">
      <span className="w-11 h-11 rounded-xl bg-green-600 text-white flex items-center justify-center shrink-0"><Icone size={22} /></span>
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-gray-800 leading-tight">{titulo}</span>
        <span className="block text-xs text-gray-500 truncate">{desc}</span>
      </span>
      <ChevronRight size={18} className="text-gray-300 shrink-0" />
    </button>
  )
  const direitos = <p className="text-[11px] text-gray-400 text-center">© {new Date().getFullYear()} Ângelo Eduardo. Todos os direitos reservados.</p>
  const caixa = 'w-full max-w-sm bg-white rounded-3xl shadow-2xl p-5 space-y-4'
  const fundo = 'min-h-screen bg-gradient-to-b from-green-700 to-green-900 flex items-center justify-center p-4'
  const p = PERFIS_APP.find(x => x.id === perfil)
  // 1) Tela inicial: 3 entradas.
  if (!g) return (
    <div className={fundo}>
      <div className={caixa}>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-green-800">S.P.A Campo</h1>
          <p className="text-sm text-gray-500">Quem é você?</p>
        </div>
        <div className="rounded-2xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
          {GRUPOS_APP.map(x => <Linha key={x.id} Icone={ICONE_GRUPO[x.id]} titulo={x.rotulo} desc={x.desc} onClick={() => escolherGrupo(x)} />)}
        </div>
        {direitos}
      </div>
    </div>
  )
  // 2) Aplicações: lista dos campos.
  if (!p) return (
    <div className={fundo}>
      <div className={caixa}>
        <div className="flex items-center gap-2">
          <button onClick={voltar} aria-label="Voltar" className="bg-gray-100 rounded-lg p-1.5 text-gray-600"><ChevronLeft size={18} /></button>
          <div><h1 className="text-xl font-bold text-green-800 leading-tight">{g.rotulo}</h1><p className="text-sm text-gray-500">Escolha o seu campo</p></div>
        </div>
        <div className="rounded-2xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
          {g.perfis.map((id, i) => {
            const [Icone, desc] = INFO[id] || [Sprout, '']
            const abreAplicadores = id.startsWith('apl_') && !g.perfis[i - 1]?.startsWith('apl_')
            return (
              <div key={id}>
                {abreAplicadores && <p className="px-3.5 py-1.5 bg-gray-50 text-[11px] font-bold tracking-wide text-gray-500 uppercase">Aplicadores por método</p>}
                <Linha Icone={Icone} titulo={PERFIS_APP.find(x => x.id === id)?.rotulo} desc={desc} onClick={() => { setPerfil(id); setErro('') }} />
              </div>
            )
          })}
        </div>
        {direitos}
      </div>
    </div>
  )
  // 3) Nome e senha do perfil escolhido.
  const [Icone, desc] = INFO[p.id] || [Sprout, '']
  return (
    <div className={fundo}>
      <form onSubmit={entrar} className={caixa}>
        <div className="flex items-center gap-2">
          <button type="button" onClick={voltar} aria-label="Voltar" className="bg-gray-100 rounded-lg p-1.5 text-gray-600"><ChevronLeft size={18} /></button>
          <span className="w-10 h-10 rounded-xl bg-green-600 text-white flex items-center justify-center shrink-0"><Icone size={20} /></span>
          <div className="min-w-0"><h1 className="text-xl font-bold text-green-800 leading-tight">{p.rotulo}</h1><p className="text-xs text-gray-500 truncate">{desc}</p></div>
        </div>
        <label className="block">
          <span className="text-xs font-semibold text-gray-500">Seu nome</span>
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: João" className={campo} autoComplete="name" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-500">Senha</span>
          <input type="password" value={senha} onChange={e => setSenha(e.target.value)} className={campo} autoComplete="current-password" />
        </label>
        {erro && <p className="text-sm font-semibold text-red-600 text-center">{erro}</p>}
        <button className="w-full flex items-center justify-center gap-2 bg-green-600 active:bg-green-700 text-white font-bold text-lg rounded-2xl py-3.5"><LogIn size={20} /> Entrar</button>
        {direitos}
      </form>
    </div>
  )
}
