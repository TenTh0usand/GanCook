'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { dishes, dishCategories, dishCookLogs, menuFeatures } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/user'
import { getSettings } from '@/lib/settings'
import { todayLocal } from '@/lib/time'
import { saveImage, deleteImage, fileToBuffer, imageUploadError } from '@/lib/images'
import { getT, type TFn } from '@/lib/i18n/server'

export type ActionResult = { ok: true } | { ok: false; error: string }

function parseTags(raw: FormDataEntryValue | null): string[] {
  if (!raw) return []
  return String(raw)
    .split(/[,，\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 6)
}

/**
 * GanCook-10k（P2）：读取大类 / 细类 / 家常精选。
 * 轻量原则：不合法的分类不报错，直接按「未分类」处理；细类不属于所选大类时自动丢弃。
 */
function readMeta(form: FormData) {
  const cats = db.select().from(dishCategories).all()
  const byId = new Map(cats.map((c) => [c.id, c]))
  const rawCat = String(form.get('category') ?? '')
  const rawSub = String(form.get('subcategory') ?? '')
  const category = byId.get(rawCat) && !byId.get(rawCat)!.parentId ? rawCat : null
  const sub = byId.get(rawSub)
  const subcategory = category && sub && sub.parentId === category ? rawSub : null
  const pinned = form.get('pinned') === '1'
  return { category, subcategory, pinned }
}

function revalidateMenus() {
  revalidatePath('/dishes')
  revalidatePath('/meals', 'layout')
  revalidatePath('/admin')
}

function readName(form: FormData, t: TFn): string | { error: string } {
  const name = String(form.get('name') ?? '').trim()
  if (!name) return { error: t('err.dishNameRequired') }
  if (name.length > 30) return { error: t('err.dishNameTooLong') }
  return name
}

export async function createDish(form: FormData): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }

  const name = readName(form, t)
  if (typeof name !== 'string') return { ok: false, error: name.error }

  const description = String(form.get('description') ?? '').trim().slice(0, 200) || null
  const tags = parseTags(form.get('tags'))

  let imagePath: string | null = null
  const file = form.get('image')
  if (file instanceof File && file.size > 0) {
    try {
      imagePath = await saveImage(await fileToBuffer(file), 'dishes')
    } catch (e) {
      return { ok: false, error: imageUploadError(t, e) }
    }
  }

  db.insert(dishes)
    .values({ name, description, tags, imagePath, createdBy: me.id, ...readMeta(form) })
    .run()

  revalidateMenus()
  return { ok: true }
}

export async function updateDish(
  id: string,
  form: FormData,
): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  const dish = db.select().from(dishes).where(eq(dishes.id, id)).get()
  if (!dish) return { ok: false, error: t('err.dishNotFound') }
  if (dish.createdBy !== me.id && !me.isAdmin)
    return { ok: false, error: t('err.onlyOwnerDishEdit') }

  const name = readName(form, t)
  if (typeof name !== 'string') return { ok: false, error: name.error }

  const description = String(form.get('description') ?? '').trim().slice(0, 200) || null
  const tags = parseTags(form.get('tags'))

  let imagePath = dish.imagePath
  const file = form.get('image')
  if (file instanceof File && file.size > 0) {
    try {
      const newPath = await saveImage(await fileToBuffer(file), 'dishes')
      await deleteImage(dish.imagePath)
      imagePath = newPath
    } catch (e) {
      return { ok: false, error: imageUploadError(t, e) }
    }
  }

  db.update(dishes)
    .set({ name, description, tags, imagePath, ...readMeta(form) })
    .where(eq(dishes.id, id))
    .run()

  revalidateMenus()
  return { ok: true }
}

export async function setDishStatus(
  id: string,
  status: 'active' | 'archived',
): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  const dish = db.select().from(dishes).where(eq(dishes.id, id)).get()
  if (!dish) return { ok: false, error: t('err.dishNotFound') }
  if (dish.createdBy !== me.id && !me.isAdmin)
    return { ok: false, error: t('err.onlyOwnerDishEdit') }
  db.update(dishes).set({ status }).where(eq(dishes.id, id)).run()
  revalidateMenus()
  return { ok: true }
}

export async function deleteDish(id: string): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  const dish = db.select().from(dishes).where(eq(dishes.id, id)).get()
  if (!dish) return { ok: true }
  if (dish.createdBy !== me.id && !me.isAdmin)
    return { ok: false, error: t('err.onlyOwnerDishDel') }

  // 级联删除 menu_features 前先收集关联海报图，避免落盘图片孤立
  const posters = db
    .select({ posterPath: menuFeatures.posterPath })
    .from(menuFeatures)
    .where(eq(menuFeatures.dishId, id))
    .all()
    .map((f) => f.posterPath)

  db.delete(dishes).where(eq(dishes.id, id)).run()
  await deleteImage(dish.imagePath)
  for (const p of posters) await deleteImage(p)

  revalidateMenus()
  return { ok: true }
}

/**
 * 「我做过」+1（GanCook-10k · P2）：没开饭局时补记做过次数。
 * 任何家庭成员都能记（记在自己名下），默认日期为今天。
 */
export async function logCooked(dishId: string, date?: string): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  const dish = db.select({ id: dishes.id }).from(dishes).where(eq(dishes.id, dishId)).get()
  if (!dish) return { ok: false, error: t('err.dishNotFound') }
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayLocal(getSettings().timezone)
  db.insert(dishCookLogs).values({ dishId, userId: me.id, date: day }).run()
  revalidateMenus()
  return { ok: true }
}

/** 删除一条「我做过」记录：本人或管理员 */
export async function deleteCookLog(logId: string): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  const log = db.select().from(dishCookLogs).where(eq(dishCookLogs.id, logId)).get()
  if (!log) return { ok: true }
  if (log.userId !== me.id && !me.isAdmin) return { ok: false, error: t('err.onlyOwnLog') }
  db.delete(dishCookLogs).where(eq(dishCookLogs.id, logId)).run()
  revalidateMenus()
  return { ok: true }
}
