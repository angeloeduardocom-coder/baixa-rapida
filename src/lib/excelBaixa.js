// Gera a baixa como arquivo Excel (.xlsx) no MESMO modelo da "Planilha_Fertirrigacao_LOCAL":
// título, DATA, cabeçalho (PRODUTOS · QNT. USO · TRANSFERÊNCIA · LOCAL · DEVOLUÇÃO · OBSERVAÇÃO),
// os produtos escolhidos, linhas em branco até completar a folha e o quadro LOCAL/RESPONSÁVEL/OBSERVAÇÃO.
// O exceljs é pesado, então só carrega quando o botão é usado.
import { valoresDaLinha } from './imagemTabela'

const TITULOS = ['PRODUTOS', 'QNT. USO', 'TRANSFERÊNCIA', 'LOCAL', 'DEVOLUÇÃO', 'OBSERVAÇÃO']
const LARGURAS = [38, 14, 18, 18, 16, 28]
const LINHAS_MIN = 20
const VERDE_ESCURO = 'FF77933C'
const VERDE_CLARO = 'FFDDEBCF'

const dataBR = iso => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('/') : String(iso || ''))

// Carrega o exceljs com antecedência (o celular só deixa compartilhar logo depois do toque).
export const aquecerExcel = () => import('exceljs').catch(() => {})

export async function gerarExcelBaixa(titulo, linhas, data) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Baixa', { pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } })
  LARGURAS.forEach((w, i) => { ws.getColumn(i + 1).width = w })
  const n = TITULOS.length
  const borda = { style: 'thin', color: { argb: 'FF9CA3AF' } }
  const bordas = { top: borda, left: borda, bottom: borda, right: borda }
  const fill = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })

  // Título (sem o " - DATA: ..." que vem no texto do app: a data vai na linha de baixo).
  const nomeTitulo = String(titulo || 'PRODUTOS FERTIRRIGAÇÃO').split(/\s+-\s+DATA/i)[0].toUpperCase()
  ws.mergeCells(1, 1, 1, n)
  const t = ws.getCell(1, 1)
  t.value = nomeTitulo
  t.font = { bold: true, size: 13 }
  t.alignment = { horizontal: 'center', vertical: 'middle' }
  t.fill = fill(VERDE_CLARO)
  ws.mergeCells(2, 1, 2, n)
  const d = ws.getCell(2, 1)
  d.value = `DATA: ${dataBR(data)}`
  d.font = { bold: true, size: 10 }
  d.alignment = { horizontal: 'center', vertical: 'middle' }
  d.fill = fill(VERDE_ESCURO)
  for (let c = 1; c <= n; c++) { ws.getCell(1, c).border = bordas; ws.getCell(2, c).border = bordas }

  const cab = ws.getRow(3)
  TITULOS.forEach((tt, i) => {
    const c = cab.getCell(i + 1)
    c.value = tt
    c.font = { bold: true, size: 10 }
    c.alignment = { horizontal: 'left', vertical: 'middle' }
    c.fill = fill(VERDE_CLARO)
    c.border = bordas
  })

  const total = Math.max(LINHAS_MIN, linhas.length)
  for (let i = 0; i < total; i++) {
    const row = ws.getRow(4 + i)
    const l = linhas[i]
    const [produto, qtd] = l ? valoresDaLinha(l) : ['', '']
    for (let j = 0; j < n; j++) {
      const c = row.getCell(j + 1)
      if (j === 0) c.value = produto
      if (j === 1) {
        const num = qtd !== '' && /^-?[\d.,]+$/.test(qtd) ? Number(qtd.replace(/\./g, '').replace(',', '.')) : qtd
        c.value = qtd === '' ? null : Number.isFinite(num) ? num : qtd
        if (typeof c.value === 'number') c.numFmt = '0.0##'
      }
      c.alignment = { horizontal: j === 1 ? 'right' : 'left', vertical: 'middle' }
      c.font = { size: 10 }
      c.border = bordas
    }
    row.height = 16
  }

  // Quadro de baixo: LOCAL · RESPONSÁVEL · OBSERVAÇÃO.
  const r0 = 4 + total + 2
  const tres = [[1, 2, 'LOCAL'], [3, 4, 'RESPONSÁVEL'], [5, 6, 'OBSERVAÇÃO']]
  tres.forEach(([a, b, nome]) => {
    ws.mergeCells(r0, a, r0, b)
    const c = ws.getCell(r0, a)
    c.value = nome
    c.font = { bold: true, size: 10 }
    c.alignment = { horizontal: 'center', vertical: 'middle' }
    c.fill = fill(VERDE_CLARO)
    ws.mergeCells(r0 + 1, a, r0 + 1, b)
    for (let x = a; x <= b; x++) { ws.getCell(r0, x).border = bordas; ws.getCell(r0 + 1, x).border = bordas }
  })
  ws.getRow(r0 + 1).height = 24

  ws.getRow(1).height = 22
  const buf = await wb.xlsx.writeBuffer()
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
