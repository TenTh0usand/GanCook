import { extname } from 'node:path'
import { serveFile } from '@/lib/storage'

const TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
}

/**
 * 图片读取：本机文件直接返回；S3 / R2 对象（路径以 s3/ 开头）配置了公开域名时 302 到 CDN，否则由 NAS 中转。
 * 路径越界（目录穿越）一律 404。
 */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  if (path.some((seg) => seg === '..' || seg.includes('\\'))) return new Response('Not found', { status: 404 })
  const rel = path.join('/')
  const type = TYPES[extname(rel).toLowerCase()] || 'application/octet-stream'
  const res = await serveFile(rel, type).catch(() => null)
  if (!res) return new Response('Not found', { status: 404 })
  if (res.kind === 'redirect') {
    return new Response(null, {
      status: 302,
      headers: { Location: res.url, 'Cache-Control': 'public, max-age=86400' },
    })
  }
  return new Response(res.body as BodyInit, {
    headers: { 'Content-Type': res.type, 'Cache-Control': 'public, max-age=31536000, immutable' },
  })
}
