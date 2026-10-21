// Login simples do app (trava de uso neste celular, igual ao sistema — não é segurança de verdade).
// Cada perfil vê só o seu campo; o Gestor vê tudo.
export const PERFIS_APP = [
  { id: 'ferti1', rotulo: 'Ferti 1', tipos: [1], senha: 'ferti1' },
  { id: 'ferti2', rotulo: 'Ferti 2', tipos: [2], senha: 'ferti2' },
  { id: 'pulv', rotulo: 'Pulverização', tipos: ['pulv'], senha: 'pulv123' },
  { id: 'gestor', rotulo: 'Gestor (vê tudo)', tipos: [1, 2, 'pulv'], senha: 'gestor123' },
]
export const perfilDe = id => PERFIS_APP.find(p => p.id === id) || null
// Transferência sem tipo (feita antes do login existir, ou na tela de Transferência da Adubação
// do sistema) é das Ferti — não aparece pra Pulverização.
export const transfVisivel = (t, perfil) => {
  if (!perfil || perfil.id === 'gestor') return true
  if (t.tipo == null) return perfil.tipos.includes(1) || perfil.tipos.includes(2)
  return perfil.tipos.includes(t.tipo)
}
