import 'server-only'
import sharp from 'sharp'
import { putFile, removeFile, resolveUploadPath } from '@/lib/storage'

/**
 * 图片处理 + 存储（存到本机或 S3 / R2，见 lib/storage.ts）：
 * - 普通图片（菜品 / 头像 / 海报 / 备菜）：自动转正 → 长边 ≤ 1280 → WebP(q80)
 * - 饭局照片 / 评价图：长边 ≤ 2560 且 ≤ 2MB 的大图 + 长边 480 的缩略图
 * sharp 默认不保留 EXIF，所以照片里的 GPS 位置等信息会被去掉。
 * DB 只保存返回的路径，如 "dishes/xxxx.webp" 或 "s3/photos/xxxx.webp"。
 */
const MAX_SIDE = 1280
export const PHOTO_MAX_SIDE = 2560
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024
const THUMB_SIDE = 480

export { resolveUploadPath }

export async function saveImage(
  buffer: Buffer,
  subdir: 'dishes' | 'avatars' | 'posters' | 'prep',
): Promise<string> {
  const out = await sharp(buffer)
    .rotate()
    .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()
  return putFile(subdir, `${crypto.randomUUID()}.webp`, out)
}

/** 饭局照片：大图（≤2560、≤2MB）+ 缩略图 */
export async function savePhoto(buffer: Buffer): Promise<{
  id: string
  path: string
  thumbPath: string
  width: number
  height: number
}> {
  const base = sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize(PHOTO_MAX_SIDE, PHOTO_MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
  let big: { data: Buffer; info: sharp.OutputInfo } | null = null
  for (const quality of [82, 72, 62, 52, 42]) {
    big = await base.clone().webp({ quality }).toBuffer({ resolveWithObject: true })
    if (big.data.length <= PHOTO_MAX_BYTES) break
  }
  // 极端情况（超大全景图）：再缩一档
  if (big!.data.length > PHOTO_MAX_BYTES) {
    big = await sharp(big!.data).resize(1920, 1920, { fit: 'inside' }).webp({ quality: 60 }).toBuffer({ resolveWithObject: true })
  }
  const thumb = await sharp(big!.data).resize(THUMB_SIDE, THUMB_SIDE, { fit: 'inside' }).webp({ quality: 70 }).toBuffer()
  const id = crypto.randomUUID()
  const path = await putFile('photos', `${id}.webp`, big!.data)
  const thumbPath = await putFile('photos', `${id}_t.webp`, thumb)
  return { id, path, thumbPath, width: big!.info.width, height: big!.info.height }
}

/** 删除一张已存图片（容错：文件不存在不报错） */
export async function deleteImage(relPath: string | null | undefined) {
  await removeFile(relPath)
}

/** 校验并读取上传文件为 Buffer（限制类型与大小） */
export async function fileToBuffer(
  file: File,
  maxBytes = 5 * 1024 * 1024,
): Promise<Buffer> {
  // 抛出稳定错误码，由调用方按语言翻译
  if (!file.type.startsWith('image/')) throw new Error('IMAGE_ONLY')
  if (file.size > maxBytes) throw new Error('IMAGE_TOO_LARGE')
  return Buffer.from(await file.arrayBuffer())
}

/** 将图片校验/处理异常翻译为用户可读提示 */
export function imageUploadError(
  t: (key: string) => string,
  err: unknown,
): string {
  return (err as Error | undefined)?.message === 'IMAGE_TOO_LARGE'
    ? t('err.imageTooLarge')
    : t('err.imageOnly')
}
