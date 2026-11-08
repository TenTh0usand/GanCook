'use server'

import { revalidatePath } from 'next/cache'
import { asc, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { dishCategories, dishes, menuFeatures } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/user'
import { saveImage, deleteImage, fileToBuffer } from '@/lib/images'
import { getT } from '@/lib/i18n/server'

/**
 * 菜单管理（GanCook-10k · P2 第 4 步）：分类管理 + 本季推荐管理。仅管理员。
 * 轻量原则：名字留空 / 日期格式不对等不报错，尽量自动修正。
 */

export type ActionResult = { ok: true } | { ok: false; error: string }

const OTHER = 'other'
const reDate = /^\d{4}-\d{2}-\d{2}$/

async function admin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  if (!me.isAdmin) return { ok: false, error: t('err.adminRequired') }
  return { ok: true }
}

function refresh() {
  revalidatePath('/admin')
  revalidatePath('/dishes')
  revalidatePath('/meals', 'layout')
}

/* ───────── 分类 ───────── */

function siblings(parentId: string | null) {
  return db
    .select()
    .from(dishCategories)
    .where(parentId ? eq(dishCategories.parentId, parentId) : isNull(dishCategories.parentId))
    .orderBy(asc(dishCategories.sort))
    .all()
}

export async function createCategory(input: { name: string; parentId: string | null }): Promise<ActionResult> {
  const r = await admin()
  if (!r.ok) return r
  const t = await getT()
  const name = input.name.trim().slice(0, 10)
  if (!name) return { ok: false, error: t('err.categoryName') }
  const parentId = input.parentId || null
  if (parentId) {
    const p = db.select().from(dishCategories).where(eq(dishCategories.id, parentId)).get()
    if (!p || p.parentId) return { ok: false, error: t('err.badInput') }
  }
  const sibs = siblings(parentId).filter((c) => c.id !== OTHER)
  const sort = (sibs.at(-1)?.sort ?? 0) + 1
  db.insert(dishCategories).values({ name, parentId, sort }).run()
  refresh()
  return { ok: true }
}

export async function updateCategory(
  id: string,
  input: { name: string; badge: string },
): Promise<ActionResult> {
  const r = await admin()
  if (!r.ok) return r
  const t = await getT()
  const name = input.name.trim().slice(0, 10)
  if (!name) return { ok: false, error: t('err.categoryName') }
  const badge = input.badge.trim().slice(0, 6) || null
  db.update(dishCategories).set({ name, badge }).where(eq(dishCategories.id, id)).run()
  refresh()
  return { ok: true }
}

/** 上移 / 下移（与同级相邻的交换顺序；「其他」固定在最后） */
export async function moveCategory(id: string, dir: -1 | 1): Promise<ActionResult> {
  const r = await admin()
  if (!r.ok) return r
  const cur = db.select().from(dishCategories).where(eq(dishCategories.id, id)).get()
  if (!cur || cur.id === OTHER) return { ok: true }
  const sibs = siblings(cur.parentId).filter((c) => c.id !== OTHER)
  const i = sibs.findIndex((c) => c.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= sibs.length) return { ok: true }
  // 重新编号后交换，避免 sort 值相同时交换无效
  const ordered = sibs.map((c) => c.id)
  ;[ordered[i], ordered[j]] = [ordered[j], ordered[i]]
  ordered.forEach((cid, k) =>
    db.update(dishCategories).set({ sort: k + 1 }).where(eq(dishCategories.id, cid)).run(),
  )
  refresh()
  return { ok: true }
}

/** 删除分类：用到它的菜自动归入「其他」（大类）或清空细类；删大类会连带删除其细类。「其他」不能删 */
export async function deleteCategory(id: string): Promise<ActionResult> {
  const r = await admin()
  if (!r.ok) return r
  const t = await getT()
  if (id === OTHER) return { ok: false, error: t('err.cantDeleteOther') }
  const cur = db.select().from(dishCategories).where(eq(dishCategories.id, id)).get()
  if (!cur) return { ok: true }
  if (cur.parentId) {
    db.update(dishes).set({ subcategory: null }).where(eq(dishes.subcategory, id)).run()
  } else {
    db.update(dishes).set({ category: null, subcategory: null }).where(eq(dishes.category, id)).run()
    db.delete(dishCategories).where(eq(dishCategories.parentId, id)).run()
  }
  db.delete(dishCategories).where(eq(dishCategories.id, id)).run()
  refresh()
  return { ok: true }
}

/* ───────── 本季推荐 ───────── */

function readFeature(form: FormData) {
  const title = String(form.get('title') ?? '').trim().slice(0, 12) || null
  let startDate = String(form.get('startDate') ?? '')
  let endDate = String(form.get('endDate') ?? '')
  startDate = reDate.test(startDate) ? startDate : ''
  endDate = reDate.test(endDate) ? endDate : ''
  // 起止日期填反了就自动对调
  if (startDate && endDate && startDate > endDate) [startDate, endDate] = [endDate, startDate]
  return { title, startDate: startDate || null, endDate: endDate || null }
}

async function readPoster(form: FormData): Promise<string | null | 'error'> {
  const file = form.get('poster')
  if (!(file instanceof File) || file.size === 0) return null
  try {
    return await saveImage(await fileToBuffer(file), 'posters')
  } catch {
    return 'error'
  }
}

export async function createFeature(form: FormData): Promise<ActionResult> {
  const r = await admin()
  if (!r.ok) return r
  const t = await getT()
  const dishId = String(form.get('dishId') ?? '')
  const dish = db.select({ id: dishes.id }).from(dishes).where(eq(dishes.id, dishId)).get()
  if (!dish) return { ok: false, error: t('err.pickDish') }
  const poster = await readPoster(form)
  if (poster === 'error') return { ok: false, error: t('err.imageOnly') }
  const last = db.select().from(menuFeatures).orderBy(asc(menuFeatures.sort)).all().at(-1)
  db.insert(menuFeatures)
    .values({ dishId, posterPath: poster, sort: (last?.sort ?? 0) + 1, ...readFeature(form) })
    .run()
  refresh()
  return { ok: true }
}

export async function updateFeature(id: string, form: FormData): Promise<ActionResult> {
  const r = await admin()
  if (!r.ok) return r
  const t = await getT()
  const cur = db.select().from(menuFeatures).where(eq(menuFeatures.id, id)).get()
  if (!cur) return { ok: false, error: t('err.badInput') }
  const dishId = String(form.get('dishId') ?? '') || cur.dishId
  let posterPath = cur.posterPath
  const poster = await readPoster(form)
  if (poster === 'error') return { ok: false, error: t('err.imageOnly') }
  if (poster) {
    await deleteImage(cur.posterPath)
    posterPath = poster
  } else if (form.get('removePoster') === '1') {
    await deleteImage(cur.posterPath)
    posterPath = null
  }
  db.update(menuFeatures)
    .set({ dishId, posterPath, ...readFeature(form) })
    .where(eq(menuFeatures.id, id))
    .run()
  refresh()
  return { ok: true }
}

export async function deleteFeature(id: string): Promise<ActionResult> {
  const r = await admin()
  if (!r.ok) return r
  const cur = db.select().from(menuFeatures).where(eq(menuFeatures.id, id)).get()
  if (!cur) return { ok: true }
  await deleteImage(cur.posterPath)
  db.delete(menuFeatures).where(eq(menuFeatures.id, id)).run()
  refresh()
  return { ok: true }
}

export async function moveFeature(id: string, dir: -1 | 1): Promise<ActionResult> {
  const r = await admin()
  if (!r.ok) return r
  const all = db.select().from(menuFeatures).orderBy(asc(menuFeatures.sort), asc(menuFeatures.createdAt)).all()
  const i = all.findIndex((f) => f.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= all.length) return { ok: true }
  const ids = all.map((f) => f.id)
  ;[ids[i], ids[j]] = [ids[j], ids[i]]
  ids.forEach((fid, k) => db.update(menuFeatures).set({ sort: k + 1 }).where(eq(menuFeatures.id, fid)).run())
  refresh()
  return { ok: true }
}

