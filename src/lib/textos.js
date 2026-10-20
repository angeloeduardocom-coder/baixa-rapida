import { dataBR, diaMes } from './useLocal'
import { valoresDaLinha } from './imagemTabela'

export function tituloBaixa(ferti, data) {
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
export function textoTransferencias(data, itens) {
  const out = ['*SALDO ANTERIOR E TRANSFERÊNCIAS DE INSUMOS*', `DATA: ${diaMes(data)}`]
  itens.forEach(t => {
    out.push('')
    out.push(`🧪*${v(t.produto).toUpperCase()}:*`)
    out.push(`📊SALDO ANT.: ${v(t.saldoAnt)}`)
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
