// Fotos: reduz (foto de celular vem com 4000+ px), guarda em IndexedDB (localStorage estoura com
// "sem espaço") e escreve uma faixa de identificação na imagem que vai pro WhatsApp.

export function comprimirImagem(arquivo, ladoMax = 1800, qualidade = 0.86) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo)
    const img = new Image()
    img.onload = () => {
      const escala = Math.min(1, ladoMax / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * escala)
      canvas.height = Math.round(img.height * escala)
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', qualidade))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não consegui abrir a imagem')) }
    img.src = url
  })
}

export function carimbarFoto(dataUrl, titulo) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const faixa = Math.max(56, Math.round(img.height * 0.07))
      ctx.fillStyle = 'rgba(0,0,0,0.72)'
      ctx.fillRect(0, 0, canvas.width, faixa)
      let tam = Math.round(faixa * 0.55)
      ctx.font = `bold ${tam}px sans-serif`
      while (ctx.measureText(titulo).width > canvas.width - 32 && tam > 14) { tam -= 2; ctx.font = `bold ${tam}px sans-serif` }
      ctx.fillStyle = '#fff'
      ctx.textBaseline = 'middle'
      ctx.fillText(titulo, 16, faixa / 2)
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Falha ao gerar a foto'))), 'image/jpeg', 0.88)
    }
    img.onerror = () => reject(new Error('Foto inválida'))
    img.src = dataUrl
  })
}

const BANCO = 'baixa_fotos'
const LOJA = 'fotos'
function abrir() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB indisponível'))
    const req = indexedDB.open(BANCO, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(LOJA)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
export async function salvarFotoLocal(chave, dataUrl) {
  const db = await abrir()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(LOJA, 'readwrite')
    if (dataUrl) tx.objectStore(LOJA).put(dataUrl, chave); else tx.objectStore(LOJA).delete(chave)
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}
export async function lerFotosLocais() {
  const db = await abrir()
  return new Promise((resolve, reject) => {
    const mapa = {}
    const req = db.transaction(LOJA, 'readonly').objectStore(LOJA).openCursor()
    req.onsuccess = () => { const c = req.result; if (c) { mapa[c.key] = c.value; c.continue() } else resolve(mapa) }
    req.onerror = () => reject(req.error)
  })
}
