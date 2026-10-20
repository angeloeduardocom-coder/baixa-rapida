// Gera a tabela da baixa como arquivo Excel (.xlsx) no mesmo modelo da planilha: título,
// cabeçalho e linhas com borda. O exceljs é pesado, então só carrega quando o botão é usado.
import { valoresDaLinha } from './imagemTabela'

const TITULOS = ['PRODUTO', 'QUANTIDADE', 'UNIDADE']
const LARGURAS = [42, 16, 12]

export async function gerarExcelBaixa(titulo, linhas) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Baixa')
  LARGURAS.forEach((w, i) => { ws.getColumn(i + 1).width = w })
  const borda = { style: 'thin', color: { argb: 'FF000000' } }
  const bordas = { top: borda, left: borda, bottom: borda, right: borda }
  const fundo = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }

  ws.mergeCells(1, 1, 1, TITULOS.length)
  const t = ws.getCell(1, 1)
  t.value = titulo
  t.font = { bold: true, size: 13 }
  t.alignment = { horizontal: 'center', vertical: 'middle' }
  t.fill = fundo
  for (let c = 1; c <= TITULOS.length; c++) ws.getCell(1, c).border = bordas

  const cab = ws.getRow(2)
  TITULOS.forEach((tt, i) => {
    const c = cab.getCell(i + 1)
    c.value = tt
    c.font = { bold: true }
    c.alignment = { horizontal: 'center', vertical: 'middle' }
    c.fill = fundo
    c.border = bordas
  })

  ;(linhas.length ? linhas : [{}]).forEach((l, i) => {
    const row = ws.getRow(3 + i)
    valoresDaLinha(l).forEach((v, j) => {
      const c = row.getCell(j + 1)
      c.value = v
      c.font = { bold: j === 0 }
      c.alignment = { horizontal: j === 0 ? 'left' : 'center', vertical: 'middle' }
      c.border = bordas
    })
  })
  ws.getRow(1).height = 24
  const buf = await wb.xlsx.writeBuffer()
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
