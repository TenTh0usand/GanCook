import 'server-only'
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { db } from '@/lib/db/client'
import { DATA_DIR, UPLOAD_DIR } from '@/lib/env'
import { resolveUploadPath } from '@/lib/images'
import { APP_VERSION } from '@/lib/version'

/**
 * GanCook-10k · 数据导入导出
 *
 * 一个 JSON 文件就是一份完整备份：表数据（原样行）+ 上传图片（base64）。
 * - full   ：全部数据。导入 = 用备份整体替换当前数据（导入前自动在 data/backups 留一份当前数据）
 * - dishes ：只含菜品库（菜品 + 分类 + 菜品图片）。导入 = 合并，同名菜品跳过，可用于家庭之间分享菜单
 */
export const BACKUP_FORMAT = 'gancook-backup'
export type BackupKind = 'full' | 'dishes'
type Row = Record<string, unknown>

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  formatVersion: 1
  kind: BackupKind
  appVersion: string
  schemaVersion: number
  exportedAt: string
  tables: Record<string, Row[]>
  files: Record<string, string>
}

export type ImportSummary = {
  kind: BackupKind
  rows: number
  files: number
  added?: number
  skipped?: number
}

const IMAGE_PATH_RE = /^(dishes|avatars|posters|prep)\/[A-Za-z0-9_-]+\.(webp|png|jpe?g)$/
const MAX_FILE_BYTES = 8 * 1024 * 1024
const KEEP_SNAPSHOTS = 5

const sqlite = () => db.$client

function userTables(): string[] {
  const rows = sqlite()
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[]
  return rows.map((r) => r.name).filter((n) => !n.startsWith('__'))
}

function columnsOf(table: string): string[] {
  return (sqlite().prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]).map((c) => c.name)
}

function schemaVersion(): number {
  try {
    const r = sqlite().prepare('SELECT count(*) AS c FROM "__drizzle_migrations"').get() as { c: number }
    return r.c
  } catch {
    return 0
  }
}

function selectAll(table: string): Row[] {
  return sqlite().prepare(`SELECT * FROM "${table}"`).all() as Row[]
}

async function listUploads(dir = UPLOAD_DIR, prefix = ''): Promise<string[]> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const out: string[] = []
  for (const e of entries) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name
    if (e.isDirectory()) out.push(...(await listUploads(join(dir, e.name), rel)))
    else if (IMAGE_PATH_RE.test(rel)) out.push(rel)
  }
  return out
}

async function readFiles(paths: Iterable<string>): Promise<Record<string, string>> {
  const files: Record<string, string> = {}
  for (const rel of paths) {
    const abs = resolveUploadPath(rel)
    if (!abs || !IMAGE_PATH_RE.test(rel)) continue
    try {
      files[rel] = (await readFile(abs)).toString('base64')
    } catch {
      // 文件已丢失：跳过
    }
  }
  return files
}

/** 生成备份 */
export async function createBackup(kind: BackupKind): Promise<BackupFile> {
  const tables: Record<string, Row[]> = {}
  let filePaths: string[]

  if (kind === 'full') {
    for (const t of userTables()) tables[t] = selectAll(t)
    filePaths = await listUploads()
  } else {
    tables.dish_categories = selectAll('dish_categories')
    tables.dishes = selectAll('dishes').map((d) => ({ ...d, created_by: null }))
    filePaths = tables.dishes.map((d) => d.image_path).filter((p): p is string => typeof p === 'string')
  }

  return {
    format: BACKUP_FORMAT,
    formatVersion: 1,
    kind,
    appVersion: APP_VERSION,
    schemaVersion: schemaVersion(),
    exportedAt: new Date().toISOString(),
    tables,
    files: await readFiles(filePaths),
  }
}

/** 校验上传的备份文件结构，返回错误码或解析结果 */
export function parseBackup(raw: unknown): BackupFile | 'BAD_FORMAT' | 'NEWER_SCHEMA' {
  const b = raw as Partial<BackupFile> | null
  if (!b || b.format !== BACKUP_FORMAT || b.formatVersion !== 1) return 'BAD_FORMAT'
  if (b.kind !== 'full' && b.kind !== 'dishes') return 'BAD_FORMAT'
  if (!b.tables || typeof b.tables !== 'object') return 'BAD_FORMAT'
  if (typeof b.schemaVersion === 'number' && b.schemaVersion > schemaVersion()) return 'NEWER_SCHEMA'
  return { ...b, files: b.files && typeof b.files === 'object' ? b.files : {} } as BackupFile
}

function sqlValue(v: unknown): unknown {
  if (v === undefined) return null
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v !== null && typeof v === 'object') return JSON.stringify(v)
  return v
}

async function writeUpload(rel: string, base64: string): Promise<boolean> {
  if (!IMAGE_PATH_RE.test(rel) || typeof base64 !== 'string') return false
  const abs = resolveUploadPath(rel)
  if (!abs) return false
  const buf = Buffer.from(base64, 'base64')
  if (!buf.length || buf.length > MAX_FILE_BYTES) return false
  await mkdir(join(abs, '..'), { recursive: true })
  await writeFile(abs, buf)
  return true
}

/** 导入前把当前全部数据存一份到 data/backups（只保留最近 5 份） */
async function snapshotCurrent(): Promise<string> {
  const dir = join(DATA_DIR, 'backups')
  await mkdir(dir, { recursive: true })
  const ts = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
  const name = `before-import-${ts}.json`
  await writeFile(join(dir, name), JSON.stringify(await createBackup('full')))
  const old = (await readdir(dir)).filter((f) => f.startsWith('before-import-')).sort().reverse()
  for (const f of old.slice(KEEP_SNAPSHOTS)) await unlink(join(dir, f)).catch(() => {})
  return name
}

/** 全量恢复：清空所有表后写入备份数据（单事务，失败自动回滚） */
async function restoreFull(b: BackupFile): Promise<ImportSummary> {
  await snapshotCurrent()
  const s = sqlite()
  const existing = userTables()
  const existingSet = new Set(existing)
  let rows = 0

  s.pragma('foreign_keys = OFF')
  try {
    s.transaction(() => {
      for (const t of existing) s.prepare(`DELETE FROM "${t}"`).run()
      for (const [t, list] of Object.entries(b.tables)) {
        if (!existingSet.has(t) || !Array.isArray(list)) continue
        const cols = new Set(columnsOf(t))
        for (const row of list) {
          if (!row || typeof row !== 'object') continue
          const keys = Object.keys(row).filter((k) => cols.has(k))
          if (!keys.length) continue
          s.prepare(
            `INSERT INTO "${t}" (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
          ).run(...keys.map((k) => sqlValue(row[k])))
          rows++
        }
      }
      const broken = s.pragma('foreign_key_check') as unknown[]
      if (broken.length) throw new Error('FK_CHECK_FAILED')
    })()
  } finally {
    s.pragma('foreign_keys = ON')
  }

  let files = 0
  for (const [rel, data] of Object.entries(b.files)) if (await writeUpload(rel, data)) files++
  return { kind: 'full', rows, files }
}

/** 菜品库合并：分类按 id / 同名合并，菜品同名跳过，新菜品归到当前管理员名下 */
async function mergeDishes(b: BackupFile, userId: string): Promise<ImportSummary> {
  const s = sqlite()
  const cats = (Array.isArray(b.tables.dish_categories) ? b.tables.dish_categories : []) as Row[]
  const dishRows = (Array.isArray(b.tables.dishes) ? b.tables.dishes : []) as Row[]
  const localCats = selectAll('dish_categories')
  const localDishNames = new Set(
    (s.prepare('SELECT name FROM dishes').all() as { name: string }[]).map((d) => d.name.trim().toLowerCase()),
  )
  const catCols = new Set(columnsOf('dish_categories'))
  const catMap = new Map<string, string>()
  const pendingFiles: [string, string][] = []
  let added = 0
  let skipped = 0
  let rows = 0

  s.transaction(() => {
    // 先大类后细类，保证 parent_id 能映射
    const ordered = [...cats].sort((a, b2) => Number(!!a.parent_id) - Number(!!b2.parent_id))
    for (const c of ordered) {
      const id = String(c.id ?? '')
      const name = String(c.name ?? '').trim()
      if (!id || !name) continue
      const parent = c.parent_id ? (catMap.get(String(c.parent_id)) ?? null) : null
      const sameId = localCats.find((l) => l.id === id)
      const sameName = localCats.find((l) => String(l.name).trim() === name && (l.parent_id ?? null) === parent)
      if (sameId || sameName) {
        catMap.set(id, String((sameId ?? sameName)!.id))
        continue
      }
      const newId = crypto.randomUUID()
      const row: Row = { ...c, id: newId, parent_id: parent }
      const keys = Object.keys(row).filter((k) => catCols.has(k))
      s.prepare(
        `INSERT INTO dish_categories (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
      ).run(...keys.map((k) => sqlValue(row[k])))
      localCats.push(row)
      catMap.set(id, newId)
      rows++
    }

    const insert = s.prepare(
      `INSERT INTO dishes (id, name, description, image_path, tags, status, category, subcategory, pinned, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const d of dishRows) {
      const name = String(d.name ?? '').trim()
      if (!name) continue
      if (localDishNames.has(name.toLowerCase())) {
        skipped++
        continue
      }
      const id = crypto.randomUUID()
      let imagePath: string | null = null
      const src = typeof d.image_path === 'string' ? d.image_path : null
      if (src && b.files[src]) {
        const ext = src.split('.').pop()
        imagePath = `dishes/${crypto.randomUUID()}.${ext}`
        pendingFiles.push([imagePath, b.files[src]])
      }
      insert.run(
        id,
        name,
        sqlValue(d.description),
        imagePath,
        sqlValue(d.tags ?? '[]'),
        d.status === 'archived' ? 'archived' : 'active',
        d.category ? (catMap.get(String(d.category)) ?? null) : null,
        d.subcategory ? (catMap.get(String(d.subcategory)) ?? null) : null,
        d.pinned ? 1 : 0,
        userId,
      )
      localDishNames.add(name.toLowerCase())
      added++
      rows++
    }
  })()

  let files = 0
  for (const [rel, data] of pendingFiles) if (await writeUpload(rel, data)) files++
  return { kind: 'dishes', rows, files, added, skipped }
}

export async function importBackup(b: BackupFile, userId: string): Promise<ImportSummary> {
  return b.kind === 'full' ? restoreFull(b) : mergeDishes(b, userId)
}
