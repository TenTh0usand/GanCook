import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { UPLOAD_DIR } from '@/lib/env'

const UPLOAD_ROOT = resolve(UPLOAD_DIR)

const TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  // 防目录穿越：严格限制在 UPLOAD_DIR 子路径内
  const target = resolve(UPLOAD_ROOT, ...path)
  if (!target.startsWith(UPLOAD_ROOT + sep)) {
    return new Response('Not found', { status: 404 })
  }
  try {
    const data = await readFile(target)
    const type = TYPES[extname(target).toLowerCase()] || 'application/octet-stream'
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
