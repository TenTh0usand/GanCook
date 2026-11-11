'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { mealRoles, prepItems, prepLogs } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/user'
import { getSettings } from '@/lib/settings'
import { todayLocal } from '@/lib/time'
import { saveImage, deleteImage, fileToBuffer, imageUploadError } from '@/lib/images'
import { getT } from '@/lib/i18n/server'
import { findMealForSlot, hasRole, toggleRole } from '@/lib/duties'
import { isMealType, type MealType } from '@/lib/roles'
import { parsePriceCents } from '@/lib/prep'

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string }

type ItemInput = { name?: string; source?: string; qty?: string; price?: string }

const reDate = /^\d{4}-\d{2}-\d{2}$/
const SOURCES = ['bought', 'fridge', 'other'] as const

/** 解析表单里的食材列表：空行忽略；来源不认识就当「买的」；价格看不懂就当没填 */
function readItems(form: FormData) {
  let raw: ItemInput[] = []
  try {
    raw = JSON.parse(String(form.get('items') ?? '[]'))
  } catch {
    raw = []
  }
  return raw
    .map((it, i) => ({
      name: String(it.name ?? '').trim().slice(0, 30),
      source: (SOURCES as readonly string[]).includes(String(it.source))
        ? (it.source as (typeof SOURCES)[number])
        : 'bought',
      qty: String(it.qty ?? '').trim().slice(0, 20) || null,
      priceCents: parsePriceCents(it.price),
      sort: i,
    }))
    .filter((it) => it.name)
    .slice(0, 40)
}

function refresh() {
  revalidatePath('/prep')
  revalidatePath('/stats')
  revalidatePath('/me')
}

function cleanupPrepRoleIfNoLogs(userId: string, date: string, slot: MealType) {
  const others = db
    .select({ id: prepLogs.id })
    .from(prepLogs)
    .where(and(eq(prepLogs.userId, userId), eq(prepLogs.date, date), eq(prepLogs.slot, slot)))
    .get()
  if (!others) {
    db.delete(mealRoles)
      .where(
        and(
          eq(mealRoles.userId, userId),
          eq(mealRoles.date, date),
          eq(mealRoles.slot, slot),
          eq(mealRoles.kind, 'prep'),
          eq(mealRoles.source, 'prep_log'),
        ),
      )
      .run()
  }
}

/**
 * 新建 / 修改一条备菜记录（GanCook-10k · P4）。
 * - 至少要有一样食材（只有名称必填）
 * - 新建或改餐次时自动给记录人打上该餐次的「备菜」（已打过就不动）
 * - 修改：本人或管理员
 */
export async function savePrepLog(form: FormData): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }

  const id = String(form.get('id') ?? '') || null
  const rawDate = String(form.get('date') ?? '')
  const date = reDate.test(rawDate) ? rawDate : todayLocal(getSettings().timezone)
  const rawSlot = String(form.get('slot') ?? '')
  const slot: MealType = isMealType(rawSlot) ? rawSlot : 'dinner'
  const note = String(form.get('note') ?? '').trim().slice(0, 300) || null
  const items = readItems(form)
  if (items.length === 0) return { ok: false, error: t('err.prepNeedItem') }

  const cur = id ? db.select().from(prepLogs).where(eq(prepLogs.id, id)).get() : null
  if (id) {
    if (!cur) return { ok: false, error: t('err.badInput') }
    if (cur.userId !== me.id && !me.isAdmin) return { ok: false, error: t('err.onlyOwnLog') }
  }

  let imagePath: string | null | undefined = undefined
  const file = form.get('image')
  if (file instanceof File && file.size > 0) {
    try {
      imagePath = await saveImage(await fileToBuffer(file), 'prep')
    } catch (e) {
      return { ok: false, error: imageUploadError(t, e) }
    }
  } else if (cur && form.get('removeImage') === '1') {
    imagePath = null
  }

  const oldImageToDelete = cur && imagePath !== undefined ? cur.imagePath : null

  const logId = db.transaction(() => {
    const mealId = findMealForSlot(date, slot)
    if (cur) {
      db.update(prepLogs)
        .set({ date, slot, mealId, note, ...(imagePath !== undefined ? { imagePath } : {}) })
        .where(eq(prepLogs.id, cur.id))
        .run()
      db.delete(prepItems).where(eq(prepItems.logId, cur.id)).run()
      for (const it of items) db.insert(prepItems).values({ logId: cur.id, ...it }).run()

      if (cur.userId && (cur.date !== date || cur.slot !== slot)) {
        cleanupPrepRoleIfNoLogs(cur.userId, cur.date, cur.slot)
        if (!hasRole(cur.userId, date, slot, 'prep')) {
          toggleRole({ userId: cur.userId, date, slot, kind: 'prep', source: 'prep_log', mealId })
        }
      }
      return cur.id
    }

    const row = db
      .insert(prepLogs)
      .values({ userId: me.id, date, slot, mealId, note, imagePath: imagePath ?? null })
      .returning()
      .get()
    for (const it of items) db.insert(prepItems).values({ logId: row.id, ...it }).run()
    // 写了备菜记录 = 参与了这个餐次的备菜
    if (!hasRole(me.id, date, slot, 'prep')) {
      toggleRole({ userId: me.id, date, slot, kind: 'prep', source: 'prep_log', mealId })
    }
    return row.id
  })

  if (oldImageToDelete) await deleteImage(oldImageToDelete)

  refresh()
  return { ok: true, id: logId }
}

/** 删除备菜记录：本人或管理员。由这条记录自动打上的「备菜」，在该餐次没有其他记录时一并取消 */
export async function deletePrepLog(id: string): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  const cur = db.select().from(prepLogs).where(eq(prepLogs.id, id)).get()
  if (!cur) return { ok: true }
  if (cur.userId !== me.id && !me.isAdmin) return { ok: false, error: t('err.onlyOwnLog') }

  db.transaction(() => {
    db.delete(prepLogs).where(eq(prepLogs.id, id)).run()
    if (cur.userId) cleanupPrepRoleIfNoLogs(cur.userId, cur.date, cur.slot)
  })
  await deleteImage(cur.imagePath)

  refresh()
  return { ok: true }
}
