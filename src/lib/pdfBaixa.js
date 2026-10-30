// PDF de UMA baixa no modelo da "Planilha_Fertirrigacao_LOCAL" (o mesmo do Excel): título,
// DATA, PRODUTOS · QNT. USO · TRANSFERÊNCIA · LOCAL · DEVOLUÇÃO · OBSERVAÇÃO, linhas em branco
// e o quadro LOCAL/RESPONSÁVEL/OBSERVAÇÃO. PDF o celular deixa anexar direto no WhatsApp.
import { valoresDaLinha } from './imagemTabela'

const COLS = [['PRODUTOS', 52], ['QNT. USO', 20], ['TRANSFERÊNCIA', 26], ['LOCAL', 26], ['DEVOLUÇÃO', 24], ['OBSERVAÇÃO', 34]]
const VERDE_CLARO = [221, 235, 207]
const VERDE_ESCURO = [119, 147, 60]
const LINHAS_MIN = 20

// Carrega o jsPDF com antecedência (o celular só deixa compartilhar logo depois do toque).
export const aquecerPdf = () => import('jspdf').catch(() => {})

// Nome do arquivo: "ferti1 baixa.pdf", "ferti2 baixa.pdf", "pulverizacao baixa.pdf".
export const nomePdfBaixa = tipo => `${tipo === 'pulv' ? 'pulverizacao' : `ferti${tipo}`} baixa.pdf`

const dataBR = iso => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('/') : String(iso || ''))

export async function gerarPdfBaixa(titulo, linhas, data) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const M = 14, W = COLS.reduce((s, c) => s + c[1], 0), H = 6.5
  let y = 14
  doc.setDrawColor(156, 163, 175); doc.setLineWidth(0.2)
  const caixa = (x, yy, w, h, cor) => { if (cor) { doc.setFillColor(...cor); doc.rect(x, yy, w, h, 'FD') } else doc.rect(x, yy, w, h) }

  const nome = String(titulo || 'PRODUTOS FERTIRRIGAÇÃO').split(/\s+-\s+DATA/i)[0].toUpperCase()
  caixa(M, y, W, 9, VERDE_CLARO)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(0, 0, 0)
  doc.text(nome, M + W / 2, y + 6.2, { align: 'center' }); y += 9
  caixa(M, y, W, 6, VERDE_ESCURO)
  doc.setFontSize(9); doc.setTextColor(255, 255, 255)
  doc.text(`DATA: ${dataBR(data)}`, M + W / 2, y + 4.2, { align: 'center' }); y += 6
  doc.setTextColor(0, 0, 0)

  let x = M
  doc.setFontSize(8)
  for (const [t, w] of COLS) { caixa(x, y, w, H, VERDE_CLARO); doc.text(t, x + 1.5, y + 4.4); x += w }
  y += H

  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  const total = Math.max(LINHAS_MIN, linhas.length)
  for (let i = 0; i < total; i++) {
    if (y + H > 297 - 30) { doc.addPage(); y = 14 }
    const [produto, qtd] = linhas[i] ? valoresDaLinha(linhas[i]) : ['', '']
    x = M
    COLS.forEach(([, w], j) => {
      caixa(x, y, w, H)
      if (j === 0 && produto) doc.text(doc.splitTextToSize(produto, w - 3)[0], x + 1.5, y + 4.5)
      if (j === 1 && qtd) doc.text(String(qtd), x + w - 1.5, y + 4.5, { align: 'right' })
      x += w
    })
    y += H
  }

  y += 8
  const terco = W / 3
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
  ;['LOCAL', 'RESPONSÁVEL', 'OBSERVAÇÃO'].forEach((t, i) => {
    caixa(M + i * terco, y, terco, H, VERDE_CLARO)
    doc.text(t, M + i * terco + terco / 2, y + 4.4, { align: 'center' })
    caixa(M + i * terco, y + H, terco, 10)
  })
  return doc.output('blob')
}
