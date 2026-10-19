import { useEffect, useState } from 'react'

// useState que guarda no aparelho (localStorage) — o que a pessoa preencheu não se perde se fechar o app.
export function useLocal(chave, inicial) {
  const [valor, setValor] = useState(() => {
    try { const raw = localStorage.getItem(chave); return raw ? JSON.parse(raw) : inicial } catch { return inicial }
  })
  useEffect(() => {
    try { localStorage.setItem(chave, JSON.stringify(valor)) } catch { /* sem espaço: segue só em memória */ }
  }, [chave, valor])
  return [valor, setValor]
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2))

export function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const dataBR = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
export const diaMes = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
