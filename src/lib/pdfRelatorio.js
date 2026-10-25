// PDF do relatório do dia (aba Histórico): baixas em tabela + transferências com a foto em
// tamanho grande (a foto guardada no aparelho, ~1800 px, sem perder qualidade). O jsPDF é
// pesado, então só carrega quando o botão é usado.
import { dataBR } from './useLocal'
import { valoresDaLinha } from './imagemTabela'
import { tituloBaixa } from './textos'

const VERDE = [21, 128, 61]
const CINZA = [107, 114, 128]

function tamanhoImagem(src) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve({ w: img.width, h: img.height })
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export async function gerarPdfRelatorio({ dia, baixas, transferencias, fotos }) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const L = 210, A = 297, M = 14, largura = L - 2 * M
  let y = M

  const novaPagina = () => { doc.addPage(); y = M }
  const garantir = altura => { if (y + altura > A - M) novaPagina() }

  // Cabeçalho
  doc.setFillColor(...VERDE)
  doc.rect(0, 0, L, 24, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16)
  doc.text(`RELATÓRIO DO DIA ${dataBR(dia)}`, M, 11)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  const totalProd = baixas.reduce((n, b) => n + b.linhas.length, 0)
  const qtdFotos = transferencias.filter(t => fotos[`${t.id}:fotoTransf`]).length
  doc.text(`${totalProd} produto(s) na baixa · ${transferencias.length} transferência(s) · ${qtdFotos} foto(s)`, M, 18)
  y = 32

  // Baixas
  for (const b of baixas) {
    garantir(20)
    doc.setFillColor(...VERDE); doc.rect(M, y, largura, 8, 'F')
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
    doc.text(tituloBaixa(b.id, dia), M + 3, y + 5.5)
    y += 8
    doc.setFillColor(243, 244, 246); doc.rect(M, y, largura, 7, 'F')
    doc.setTextColor(...CINZA); doc.setFontSize(8)
    doc.text('PRODUTO', M + 3, y + 4.8)
    doc.text('QUANTIDADE', M + largura - 3, y + 4.8, { align: 'right' })
    y += 7
    doc.setTextColor(17, 24, 39); doc.setFontSize(10)
    for (const l of b.linhas) {
      garantir(7)
      const [produto, qtd, un] = valoresDaLinha(l)
      doc.setFont('helvetica', 'bold'); doc.text(produto || '—', M + 3, y + 5)
      doc.setFont('helvetica', 'normal'); doc.text(`${qtd || '—'} ${un}`, M + largura - 3, y + 5, { align: 'right' })
      doc.setDrawColor(229, 231, 235); doc.line(M, y + 7, M + largura, y + 7)
      y += 7
    }
    y += 6
  }

  // Transferências (cada uma com a foto grande)
  if (transferencias.length) {
    garantir(14)
    doc.setTextColor(17, 24, 39); doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
    doc.text(`TRANSFERÊNCIAS (${transferencias.length})`, M, y + 5)
    y += 9
  }
  for (const t of transferencias) {
    const src = fotos[`${t.id}:fotoTransf`]
    const dim = src ? await tamanhoImagem(src) : null
    // Foto ocupa a largura toda, limitada a ~60% da altura da página (pra caber o texto junto).
    let fw = largura, fh = 0
    if (dim) { fh = (dim.h / dim.w) * fw; const max = A * 0.6; if (fh > max) { fw = fw * (max / fh); fh = max } }
    garantir(30 + fh)
    doc.setDrawColor(209, 213, 219); doc.setFillColor(255, 255, 255)
    const topo = y
    doc.setTextColor(17, 24, 39); doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
    doc.text(String(t.produto || '—').toUpperCase(), M + 3, y + 6)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(55, 65, 81)
    doc.text(`Saldo anterior: ${t.saldoAnt || '—'}`, M + 3, y + 12)
    doc.text(`Qtde transferida: ${t.qtdeTransf || '—'}`, M + largura / 2, y + 12)
    doc.text(`Estoque: ${t.estoque || '—'}`, M + 3, y + 17)
    doc.text(`Destino: ${t.destino || '—'}`, M + largura / 2, y + 17)
    y += 19
    if (t.devolucao) { doc.text(`Devolução: ${t.devolucao}`, M + 3, y + 3); y += 5 }
    if (dim) {
      doc.addImage(src, 'JPEG', M + (largura - fw) / 2, y + 2, fw, fh, undefined, 'NONE')
      y += fh + 4
    } else {
      doc.setTextColor(...CINZA); doc.setFontSize(9); doc.text('Sem foto', M + 3, y + 3); y += 6
    }
    doc.rect(M, topo, largura, y - topo)
    y += 6
  }

  // Rodapé com página
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setFontSize(8); doc.setTextColor(...CINZA)
    doc.text(`S.P.A Campo · ${dataBR(dia)} · página ${i} de ${n}`, L / 2, A - 6, { align: 'center' })
  }
  return doc.output('blob')
}
