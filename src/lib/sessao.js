// Login simples do app (trava de uso neste celular, igual ao sistema — não é segurança de verdade).
// Cada perfil vê só o seu campo; o Gestor vê tudo.
export const PERFIS_APP = [
  { id: 'ferti1', rotulo: 'Ferti 1', tipos: [1], senha: 'ferti1' },
  { id: 'ferti2', rotulo: 'Ferti 2', tipos: [2], senha: 'ferti2' },
  { id: 'pulv', rotulo: 'Pulverização', tipos: ['pulv'], senha: 'pulv123' },
  { id: 'aux', rotulo: 'Auxiliar de campo', tipos: [], senha: 'aux123', somenteProgramacao: true },
  { id: 'gestor', rotulo: 'Gestor (vê tudo)', tipos: [1, 2, 'pulv'], senha: 'gestor123' },
]
// Tela inicial do app (27–28/10/2026): 3 entradas. "Aplicações" abre a lista dos perfis de aplicação
// (aplicadores por método entram aqui quando cada um for montado). Os perfis e as senhas não mudam.
export const GRUPOS_APP = [
  { id: 'gestor', rotulo: 'Gestor', desc: 'Vê e edita tudo', perfis: ['gestor'] },
  { id: 'aux', rotulo: 'Auxiliar de campo', desc: 'Programação do dia ao vivo', perfis: ['aux'] },
  { id: 'aplicacoes', rotulo: 'Aplicações', desc: 'Ferti 1, Ferti 2 e Pulverização', perfis: ['ferti1', 'ferti2', 'pulv'] },
]
export const perfilDe = id => PERFIS_APP.find(p => p.id === id) || null
// Transferência sem tipo (feita antes do login existir, ou na tela de Transferência da Adubação
// do sistema) é das Ferti — não aparece pra Pulverização.
export const transfVisivel = (t, perfil) => {
  if (!perfil || perfil.id === 'gestor') return true
  if (t.tipo == null) return perfil.tipos.includes(1) || perfil.tipos.includes(2)
  return perfil.tipos.includes(t.tipo)
}
