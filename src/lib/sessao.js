// Login simples do app (trava de uso neste celular, igual ao sistema — não é segurança de verdade).
// Cada perfil vê só o seu campo; o Gestor vê tudo.
export const PERFIS_APP = [
  { id: 'ferti1', rotulo: 'Ferti 1', tipos: [1], senha: 'ferti1' },
  { id: 'ferti2', rotulo: 'Ferti 2', tipos: [2], senha: 'ferti2' },
  { id: 'pulv', rotulo: 'Pulverização', tipos: ['pulv'], senha: 'pulv123' },
  { id: 'aux', rotulo: 'Auxiliar de campo', tipos: [], senha: 'aux123', somenteProgramacao: true },
  // Aplicadores por método (28/10/2026): por enquanto só veem a programação do dia; cada um será
  // estruturado depois, com os detalhes do método.
  { id: 'apl_tratorizado', rotulo: 'Tratorizado', metodo: 'Tratorizado', tipos: [], senha: 'tratorizado123', somenteProgramacao: true },
  { id: 'apl_drone', rotulo: 'Drone', metodo: 'Drone', tipos: [], senha: 'drone123', somenteProgramacao: true },
  { id: 'apl_costal', rotulo: 'Costal', metodo: 'Costal', tipos: [], senha: 'costal123', somenteProgramacao: true },
  { id: 'apl_esquicho', rotulo: 'Esquicho', metodo: 'Esquicho', tipos: [], senha: 'esquicho123', somenteProgramacao: true },
  { id: 'apl_lanca', rotulo: 'Lança', metodo: 'Lança', tipos: [], senha: 'lanca123', somenteProgramacao: true },
  { id: 'apl_polvilhado', rotulo: 'Polvilhado', metodo: 'Polvilhado', tipos: [], senha: 'polvilhado123', somenteProgramacao: true },
  { id: 'gestor', rotulo: 'Gestor (vê tudo)', tipos: [1, 2, 'pulv'], senha: 'gestor123' },
]
// Tela inicial do app (27–28/10/2026): 3 entradas. "Aplicações" abre a lista dos perfis de aplicação
// (aplicadores por método entram aqui quando cada um for montado). Os perfis e as senhas não mudam.
export const GRUPOS_APP = [
  { id: 'gestor', rotulo: 'Gestor', desc: 'Vê e edita tudo', perfis: ['gestor'] },
  { id: 'aux', rotulo: 'Auxiliar de campo', desc: 'Programação do dia ao vivo', perfis: ['aux'] },
  { id: 'aplicacoes', rotulo: 'Aplicações', desc: 'Ferti 1, Ferti 2, Pulverização e aplicadores', perfis: ['ferti1', 'ferti2', 'pulv', 'apl_tratorizado', 'apl_drone', 'apl_costal', 'apl_esquicho', 'apl_lanca', 'apl_polvilhado'] },
]
export const perfilDe = id => PERFIS_APP.find(p => p.id === id) || null
// Transferência sem tipo (feita antes do login existir, ou na tela de Transferência da Adubação
// do sistema) é das Ferti — não aparece pra Pulverização.
export const transfVisivel = (t, perfil) => {
  if (!perfil || perfil.id === 'gestor') return true
  if (t.tipo == null) return perfil.tipos.includes(1) || perfil.tipos.includes(2)
  return perfil.tipos.includes(t.tipo)
}
