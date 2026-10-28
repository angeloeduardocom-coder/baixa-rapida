import { dataBR, diaMes } from './useLocal'
import { valoresDaLinha } from './imagemTabela'

// `ferti` = 1 | 2 (Fertirrigação) ou 'pulv' (Pulverização).
export function tituloBaixa(ferti, data) {
  if (ferti === 'pulv') return `PRODUTOS PULVERIZAÇÃO - DATA: ${dataBR(data)}`
  return `PRODUTOS FERTIRRIGAÇÃO ${ferti} - DATA: ${dataBR(data)}`
}

// Versão em texto da tabela (pra quando não dá pra mandar a imagem): monoespaçado no WhatsApp.
export function textoBaixa(ferti, data, linhas) {
  const out = [`*${tituloBaixa(ferti, data)}*`, '']
  linhas.forEach(l => {
    const [produto, quant, unidade] = valoresDaLinha(l)
    out.push(`*${produto || '—'}:* ${quant || '—'} ${unidade}`.trim())
  })
  return out.join('\n').trim()
}

const v = x => (x == null ? '' : String(x).trim())

// Mesmo modelo da mensagem de transferência que já circula no WhatsApp.
// Itens do fluxo 'aberto' (de um estoque aberto pra outro) saem num bloco próprio.
export function textoTransferencias(data, itens) {
  const abertos = itens.filter(t => t.fluxo === 'aberto')
  const fechados = itens.filter(t => t.fluxo !== 'aberto')
  const blocos = []
  if (fechados.length) blocos.push(textoFechado(data, fechados))
  if (abertos.length) blocos.push(textoAberto(data, abertos))
  return blocos.join('\n\n')
}

function textoAberto(data, itens) {
  const out = ['*TRANSFERÊNCIA ENTRE ESTOQUES ABERTOS*', `DATA: ${diaMes(data)}`]
  itens.forEach(t => {
    out.push('')
    out.push(`➡️*${v(t.produto).toUpperCase()}:*`)
    out.push(`📦 QTDE: ${v(t.qtdeTransf)}`)
    out.push(`🏠 SAIU DE: ${v(t.estoque)}`)
    out.push(`🏠 FOI PARA: ${v(t.destino)}`)
    if (t.temFotoTransf) out.push('📷 FOTO SAÍDA: em anexo')
    if (t.temFotoChegada) out.push('📷 FOTO CHEGADA: em anexo')
  })
  return out.join('\n')
}

function textoFechado(data, itens) {
  const out = ['*SALDO ANTERIOR E TRANSFERÊNCIAS DE INSUMOS*', `DATA: ${diaMes(data)}`]
  itens.forEach(t => {
    out.push('')
    out.push(`🧪*${v(t.produto).toUpperCase()}:*`)
    out.push(`📊SALDO ANT.: ${v(t.saldoAnt)}`)
    if (v(t.qtdeProgramada)) out.push(`📋 QTDE PROGRAMADA: ${v(t.qtdeProgramada)}`)
    out.push(`📦 QTDE TRANSF: ${v(t.qtdeTransf)}`)
    if (t.temFotoTransf) out.push('📷 FOTO TRANSF.: em anexo')
    out.push(`🏠 ESTOQUE: ${v(t.estoque)}`)
    out.push(`🏠 DESTINO: ${v(t.destino)}`)
    if (v(t.devolucao)) out.push(`DEVOLUÇÃO: ${v(t.devolucao)}`)
    if (t.temFotoDevolucao) out.push('📷 FOTO DEVOLUÇÃO: em anexo')
  })
  return out.join('\n')
}

export function abrirWhatsapp(texto) {
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
}

export function baixarArquivo(blob, nome) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
