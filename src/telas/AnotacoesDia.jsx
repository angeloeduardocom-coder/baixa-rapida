import { useCallback, useEffect, useState } from 'react'
import { NotebookPen, Send, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/nuvem'
import { publicarAviso } from '../lib/avisosNuvem'

// Anotações do dia na programação (28/10/2026): o aplicador (ex.: Drone) escreve o que aconteceu
// — "choveu, não teve aplicação" — e o Gestor recebe o aviso. Fica guardado na tabela `avisos`
// com tag "anotacao:<método>:<data>:<id>", então quem abre a programação do dia vê a lista.
// Aplicador vê só as do método dele; Gestor (e quem não é aplicador) vê de todos.
const hora = iso => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export default function AnotacoesDia({ data, perfil, nome }) {
  const metodo = perfil?.metodo || ''
  const podeEscrever = !!metodo
  const [lista, setLista] = useState([])
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState('')

  const carregar = useCallback(async () => {
    if (!supabase) return
    const { data: linhas, error } = await supabase.from('avisos').select('id, criado_em, corpo, autor, tag')
      .like('tag', metodo ? `anotacao:${metodo}:${data}:%` : `anotacao:%:${data}:%`).order('criado_em', { ascending: true })
    if (!error) setLista(linhas || [])
  }, [data, metodo])

  useEffect(() => { carregar() }, [carregar])
  // Chegou anotação nova (de qualquer aparelho): recarrega.
  useEffect(() => {
    if (!supabase) return undefined
    const canal = supabase.channel(`anotacoes-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'avisos', filter: 'app=eq.baixa' }, ({ new: a }) => { if (String(a?.tag || '').startsWith('anotacao:')) carregar() })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [carregar])

  async function salvar() {
    const t = texto.trim()
    if (!t) return
    setEstado('salvando')
    const ok = await publicarAviso({
      perfis: ['gestor'],
      titulo: `Anotação — ${metodo} · ${data.split('-').reverse().slice(0, 2).join('/')}`,
      corpo: `${nome || 'Aplicador'}: ${t}`.slice(0, 500),
      tag: `anotacao:${metodo}:${data}:${Date.now().toString(36)}`,
      autor: nome || null,
    })
    if (ok) { setTexto(''); setEstado('ok'); carregar() } else setEstado('erro')
    setTimeout(() => setEstado(''), 3500)
  }

  if (!podeEscrever && !lista.length) return null
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <NotebookPen size={18} className="text-green-700" />
        <p className="flex-1 font-bold text-gray-800">Anotações do dia{metodo ? ` · ${metodo}` : ''}</p>
        <button onClick={carregar} aria-label="Atualizar anotações" className="p-1.5 text-gray-400"><RefreshCw size={15} /></button>
      </div>
      {lista.length > 0 && (
        <ul className="space-y-1.5">
          {lista.map(a => {
            const met = String(a.tag || '').split(':')[1]
            return (
              <li key={a.id} className="text-sm bg-gray-50 rounded-xl px-3 py-2">
                <p className="text-gray-800 whitespace-pre-wrap">{String(a.corpo || '').replace(/^[^:]+:\s*/, '')}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{!metodo && met ? `${met} · ` : ''}{a.autor || '—'} · {hora(a.criado_em)}</p>
              </li>
            )
          })}
        </ul>
      )}
      {podeEscrever && (
        <>
          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={3} placeholder="Ex.: Choveu, não teve aplicação hoje." className="w-full border border-gray-300 focus:border-green-600 focus:ring-2 focus:ring-green-200 rounded-xl px-3 py-2.5 text-base bg-white outline-none resize-y" />
          <button onClick={salvar} disabled={!texto.trim() || estado === 'salvando'} className="w-full flex items-center justify-center gap-2 bg-green-600 active:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold rounded-xl py-3"><Send size={17} /> Salvar anotação</button>
          {estado === 'ok' && <p className="text-xs font-semibold text-green-700 text-center">Anotação salva — o Gestor foi avisado.</p>}
          {estado === 'erro' && <p className="text-xs font-semibold text-red-600 text-center">Não salvou. Confira a internet e tente de novo.</p>}
        </>
      )}
    </div>
  )
}
