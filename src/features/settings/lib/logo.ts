const MAX_EDGE = 256
const MAX_BYTES = 140_000

export async function fileToLogoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Envie uma imagem (PNG, JPG ou WebP).')
  }

  const bitmap = await createImageBitmap(file)
  let width = bitmap.width
  let height = bitmap.height
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
  width = Math.max(1, Math.round(width * scale))
  height = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Não foi possível processar a imagem.')
  }

  function draw(nextWidth: number, nextHeight: number) {
    canvas.width = nextWidth
    canvas.height = nextHeight
    ctx!.clearRect(0, 0, nextWidth, nextHeight)
    ctx!.drawImage(bitmap, 0, 0, nextWidth, nextHeight)
  }

  draw(width, height)

  if (file.type === 'image/png') {
    let dataUrl = canvas.toDataURL('image/png')
    while (dataUrl.length > MAX_BYTES && (width > 72 || height > 72)) {
      width = Math.max(72, Math.round(width * 0.82))
      height = Math.max(72, Math.round(height * 0.82))
      draw(width, height)
      dataUrl = canvas.toDataURL('image/png')
    }
    bitmap.close()
    if (dataUrl.length > MAX_BYTES) {
      throw new Error('PNG grande demais. Use um recorte menor da logo.')
    }
    return dataUrl
  }

  let quality = 0.86
  let dataUrl = canvas.toDataURL('image/jpeg', quality)
  while (dataUrl.length > MAX_BYTES && quality > 0.45) {
    quality -= 0.1
    dataUrl = canvas.toDataURL('image/jpeg', quality)
  }
  bitmap.close()

  if (dataUrl.length > MAX_BYTES) {
    throw new Error('Imagem grande demais. Use um recorte simples da logo.')
  }

  return dataUrl
}
