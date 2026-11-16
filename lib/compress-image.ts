/**
 * 手机端压缩照片（上传前）：长边 ≤ 2560，逐步降低质量 / 尺寸直到 ≤ 2MB。
 * 用浏览器自带的 createImageBitmap + canvas，不引入任何库；自动按 EXIF 方向转正。
 * 解码失败（个别格式）时返回原文件，由服务器兜底压缩。
 */
export const CLIENT_MAX_SIDE = 2560
export const CLIENT_MAX_BYTES = 2 * 1024 * 1024

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality))
}

export async function compressImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }
  let scale = Math.min(1, CLIENT_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  try {
    for (let round = 0; round < 6; round++) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      for (const q of [0.86, 0.78, 0.7, 0.6]) {
        const blob = await toBlob(canvas, q)
        if (blob && blob.size <= CLIENT_MAX_BYTES) return blob
      }
      scale *= 0.8
    }
    return (await toBlob(canvas, 0.55)) ?? file
  } finally {
    bitmap.close()
  }
}
