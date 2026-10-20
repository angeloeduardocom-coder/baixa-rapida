// Desenha a tabela da baixa igual à planilha do Excel (título, cabeçalho e linhas com borda) numa
// imagem PNG — é ela que vai pro WhatsApp no lugar do print da planilha.
const COLUNAS = [
  { titulo: 'PRODUTO', largura: 420, alinha: 'left' },
  { titulo: 'QUANTIDADE', largura: 200, alinha: 'center' },
  { titulo: 'UNIDADE', largura: 160, alinha: 'center' },
]

// Baixa: produto, quantidade e unidade (Consumo/Transferência/Devolução ficaram na aba Transferência).
export function valoresDaLinha(l) {
  const qtd = String(l.quant ?? '').trim() || String(l.consumo ?? '').trim()
  return [String(l.produto || '').toUpperCase(), qtd, l.unidade || '']
}

export function gerarImagemBaixa(titulo, linhas) {
  const esc = 2
  const W = COLUNAS.reduce((s, c) => s + c.largura, 0)
  const alturaLinha = 56
  const H = alturaLinha * (2 + Math.max(linhas.length, 1)) + 2
  const canvas = document.createElement('canvas')
  canvas.width = W * esc + 2 * esc
  canvas.height = H * esc
  const ctx = canvas.getContext('2d')
  ctx.scale(esc, esc)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W + 2, H)
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 1.5
  ctx.textBaseline = 'middle'

  const caber = (texto, max, tam, negrito) => {
    let t = tam
    ctx.font = `${negrito ? 'bold ' : ''}${t}px Arial, sans-serif`
    while (ctx.measureText(texto).width > max && t > 10) { t -= 1; ctx.font = `${negrito ? 'bold ' : ''}${t}px Arial, sans-serif` }
  }
  const celula = (x, y, w, h, texto, { negrito = false, alinha = 'center', fundo = null, tam = 24 } = {}) => {
    if (fundo) { ctx.fillStyle = fundo; ctx.fillRect(x, y, w, h) }
    ctx.strokeRect(x + 1, y + 1, w, h)
    ctx.fillStyle = '#000'
    caber(texto, w - 20, tam, negrito)
    ctx.textAlign = alinha
    ctx.fillText(texto, alinha === 'left' ? x + 12 : x + 1 + w / 2, y + 1 + h / 2 + 1)
  }

  celula(0, 0, W, alturaLinha, titulo, { negrito: true, fundo: '#f3f4f6', tam: 26 })
  let x = 0
  COLUNAS.forEach(c => { celula(x, alturaLinha, c.largura, alturaLinha, c.titulo, { negrito: true, fundo: '#f3f4f6' }); x += c.largura })
  const dados = linhas.length ? linhas : [{}]
  dados.forEach((l, i) => {
    const y = alturaLinha * (2 + i)
    const vals = valoresDaLinha(l)
    let cx = 0
    COLUNAS.forEach((c, j) => { celula(cx, y, c.largura, alturaLinha, vals[j], { alinha: c.alinha, negrito: j === 0 }); cx += c.largura })
  })
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}
