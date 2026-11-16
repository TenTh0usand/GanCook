import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { AwsClient } from 'aws4fetch'
import { AUTH_SECRET, UPLOAD_DIR } from '@/lib/env'
import { getSetting, setSetting } from '@/lib/settings'

/**
 * GanCook-10k · 图片存储：本机 / S3 兼容（按 Cloudflare R2 优化）
 *
 * - 路径约定：本机文件存 `<subdir>/<name>`（相对 data/uploads）；S3 对象存 `s3/<subdir>/<name>`
 *   （对象 key = 路径前缀 + `<subdir>/<name>`）。旧图片原地不动，按路径前缀分别读取。
 * - 浏览器统一访问 `/api/uploads/<路径>`：本机文件直接返回；S3 对象在配置了公开域名时 302 到 CDN，否则由 NAS 中转。
 * - Secret Key 用 AUTH_SECRET 派生的密钥 AES-256-GCM 加密后存进 settings。
 */
import type { S3Config } from '@/lib/storage-types'
export type { S3Config, StorageProvider } from '@/lib/storage-types'
export type StorageSettings = { driver: 'local' | 's3'; s3: S3Config; hasSecret: boolean; secretTail: string }

const K_DRIVER = 'storage.driver'
const K_S3 = 'storage.s3'
export const K_SECRET = 'storage.s3.secret'

const EMPTY_S3: S3Config = {
  provider: 'r2',
  accountId: '',
  endpoint: '',
  region: '',
  bucket: '',
  accessKeyId: '',
  publicBase: '',
  prefix: '',
}

const UPLOAD_ROOT = resolve(UPLOAD_DIR)

/** 本机相对路径 → 绝对路径（越界返回 null） */
export function resolveUploadPath(relPath: string): string | null {
  const target = resolve(UPLOAD_ROOT, relPath)
  return target.startsWith(UPLOAD_ROOT + sep) ? target : null
}

// ── 加密 ──
const key = () => createHash('sha256').update(`gancook-storage:${AUTH_SECRET}`).digest()
function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.')
}
function decrypt(blob: string | null): string {
  if (!blob) return ''
  try {
    const [iv, tag, enc] = blob.split('.').map((s) => Buffer.from(s, 'base64'))
    const d = createDecipheriv('aes-256-gcm', key(), iv)
    d.setAuthTag(tag)
    return Buffer.concat([d.update(enc), d.final()]).toString('utf8')
  } catch {
    return ''
  }
}

// ── 配置读写 ──
export function getStorageSettings(): StorageSettings {
  let s3 = EMPTY_S3
  try {
    s3 = { ...EMPTY_S3, ...(JSON.parse(getSetting(K_S3) ?? '{}') as Partial<S3Config>) }
  } catch {}
  const secret = decrypt(getSetting(K_SECRET))
  return {
    driver: getSetting(K_DRIVER) === 's3' ? 's3' : 'local',
    s3,
    hasSecret: !!secret,
    secretTail: secret ? secret.slice(-4) : '',
  }
}

export function saveStorageSettings(driver: 'local' | 's3', s3: S3Config, secret?: string) {
  setSetting(K_DRIVER, driver)
  setSetting(K_S3, JSON.stringify(normalizeS3(s3)))
  if (secret) setSetting(K_SECRET, encrypt(secret))
}

export function normalizeS3(c: S3Config): S3Config {
  const trim = (v: string) => (v ?? '').trim()
  let prefix = trim(c.prefix).replace(/^\/+/, '')
  if (prefix && !prefix.endsWith('/')) prefix += '/'
  return {
    provider: c.provider === 's3' ? 's3' : 'r2',
    accountId: trim(c.accountId),
    endpoint: trim(c.endpoint).replace(/\/+$/, ''),
    region: trim(c.region),
    bucket: trim(c.bucket),
    accessKeyId: trim(c.accessKeyId),
    publicBase: trim(c.publicBase).replace(/\/+$/, '').replace(/^(?!https?:\/\/)(?=.)/, 'https://'),
    prefix,
  }
}

type Live = S3Config & { secret: string; url: string; regionResolved: string }

function live(c: S3Config, secret: string): Live | null {
  const n = normalizeS3(c)
  const url = n.provider === 'r2' ? (n.accountId ? `https://${n.accountId}.r2.cloudflarestorage.com` : '') : n.endpoint
  if (!url || !n.bucket || !n.accessKeyId || !secret) return null
  return { ...n, secret, url, regionResolved: n.provider === 'r2' ? 'auto' : n.region || 'us-east-1' }
}

/** 当前生效的 S3 配置（未启用或不完整时返回 null） */
function activeS3(): Live | null {
  const s = getStorageSettings()
  return live(s.s3, decrypt(getSetting(K_SECRET)))
}

/** S3 配置（不管是否启用；用于读取已经存在 S3 里的旧图片） */
function anyS3(): Live | null {
  const s = getStorageSettings()
  return live(s.s3, decrypt(getSetting(K_SECRET)))
}

const encodeKey = (k: string) => k.split('/').map(encodeURIComponent).join('/')
const objectUrl = (c: Live, k: string) => `${c.url}/${encodeURIComponent(c.bucket)}/${encodeKey(c.prefix + k)}`
const client = (c: Live) =>
  new AwsClient({ accessKeyId: c.accessKeyId, secretAccessKey: c.secret, service: 's3', region: c.regionResolved })

async function s3Put(c: Live, k: string, body: Buffer, type: string) {
  // 注意：不能直接用 client.fetch() —— 它把签好名的 Request 交给 fetch，较大的文件会变成
  // 「分块传输」而没有 Content-Length，R2 会返回 411 MissingContentLength（小测试文件不会触发）。
  // 所以先签名，再用原始字节发送，fetch 会自动带上 Content-Length。
  const bytes = new Uint8Array(body)
  const signed = await client(c).sign(objectUrl(c, k), {
    method: 'PUT',
    body: bytes,
    headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable' },
  })
  const res = await fetch(signed.url, { method: 'PUT', headers: signed.headers, body: bytes, cache: 'no-store' })
  if (!res.ok) throw new Error(`S3 PUT ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

// ── 对外接口 ──
/** 保存文件到当前存储，返回数据库里存的路径 */
export async function putFile(subdir: string, name: string, body: Buffer, type = 'image/webp'): Promise<string> {
  const k = `${subdir}/${name}`
  if (getStorageSettings().driver === 's3') {
    const c = activeS3()
    if (c) {
      await s3Put(c, k, body, type)
      return `s3/${k}`
    }
  }
  await mkdir(join(UPLOAD_ROOT, subdir), { recursive: true })
  await writeFile(join(UPLOAD_ROOT, subdir, name), body)
  return k
}

/** 删除文件（容错：不存在 / 网络失败都不报错） */
export async function removeFile(rel: string | null | undefined) {
  if (!rel) return
  try {
    if (rel.startsWith('s3/')) {
      const c = anyS3()
      if (c) await client(c).fetch(objectUrl(c, rel.slice(3)), { method: 'DELETE' })
      return
    }
    const target = resolveUploadPath(rel)
    if (target) await unlink(target)
  } catch {
    // 忽略
  }
}

export type Served = { kind: 'file'; body: Uint8Array; type: string } | { kind: 'redirect'; url: string } | null

/** /api/uploads 读取 */
export async function serveFile(rel: string, type: string): Promise<Served> {
  if (rel.startsWith('s3/')) {
    const c = anyS3()
    if (!c) return null
    const k = rel.slice(3)
    if (c.publicBase) return { kind: 'redirect', url: `${c.publicBase}/${encodeKey(c.prefix + k)}` }
    const res = await client(c).fetch(objectUrl(c, k))
    if (!res.ok) return null
    return { kind: 'file', body: new Uint8Array(await res.arrayBuffer()), type: res.headers.get('content-type') || type }
  }
  const target = resolveUploadPath(rel)
  if (!target) return null
  try {
    return { kind: 'file', body: new Uint8Array(await readFile(target)), type }
  } catch {
    return null
  }
}

export type TestStep = 'config' | 'put' | 'get' | 'public' | 'delete'

/** 网络错误时带上底层原因（如 ENOTFOUND / ECONNREFUSED / 证书错误），方便排查 */
function errText(e: unknown): string {
  const err = e as Error & { cause?: { code?: string; message?: string } }
  return String(err?.cause?.code || err?.cause?.message || err?.message || e).slice(0, 200)
}
/** 测试连接：上传 → 读取 →（有公开域名时）公开访问 → 删除，告诉你哪一步失败 */
export async function testS3(c: S3Config, secret: string): Promise<{ ok: true } | { ok: false; step: TestStep; detail: string }> {
  const l = live(c, secret)
  if (!l) return { ok: false, step: 'config', detail: '' }
  const k = `.gancook-test/${Date.now()}.txt`
  // 用约 300KB 的测试文件（和真实照片一样走「较大文件」的上传路径，小文件测不出 Content-Length 之类的问题）
  const body = Buffer.alloc(300 * 1024, 'gancook storage test ')
  try {
    await s3Put(l, k, body, 'text/plain')
  } catch (e) {
    return { ok: false, step: 'put', detail: errText(e) }
  }
  try {
    const r = await client(l).fetch(objectUrl(l, k))
    if (!r.ok || (await r.arrayBuffer()).byteLength !== body.length) throw new Error(`HTTP ${r.status}`)
  } catch (e) {
    return { ok: false, step: 'get', detail: errText(e) }
  }
  if (l.publicBase) {
    try {
      const r = await fetch(`${l.publicBase}/${encodeKey(l.prefix + k)}`, { cache: 'no-store' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
    } catch (e) {
      await client(l).fetch(objectUrl(l, k), { method: 'DELETE' }).catch(() => {})
      return { ok: false, step: 'public', detail: errText(e) }
    }
  }
  try {
    const r = await client(l).fetch(objectUrl(l, k), { method: 'DELETE' })
    if (!r.ok && r.status !== 404) throw new Error(`HTTP ${r.status}`)
  } catch (e) {
    return { ok: false, step: 'delete', detail: errText(e) }
  }
  return { ok: true }
}

/** 读取已保存的 Secret（测试连接时没重新填就用旧的） */
export function savedSecret(): string {
  return decrypt(getSetting(K_SECRET))
}
