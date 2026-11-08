'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { mealRoles, prepItems, prepLogs } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/user'
import { getSettings } from '@/lib/settings'
import { todayLocal } from '@/lib/time'
import { saveImage, deleteImage, fileToBuffer } from '@/lib/images'
import { getT } from '@/lib/i18n/server'
import { hasRole, toggleRole } from '@/lib/duties'
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

/**
 * 新建 / 修改一条备菜记录（GanCook-10k · P4）。
 * - 至少要有一样食材（只有名称必填）
 * - 新建时自动给自己打上该餐次的「备菜」（已打过就不动）
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

  let imagePath: string | null | undefined = undefined
  const file = form.get('image')
  if (file instanceof File && file.size > 0) {
    try {
      imagePath = await saveImage(await fileToBuffer(file), 'prep')
    } catch {
      return { ok: false, error: t('err.imageOnly') }
    }
  }

  let logId = id
  if (id) {
    const cur = db.select().from(prepLogs).where(eq(prepLogs.id, id)).get()
    if (!cur) return { ok: false, error: t('err.badInput') }
    if (cur.userId !== me.id && !me.isAdmin) return { ok: false, error: t('err.onlyOwnLog') }
    if (imagePath !== undefined) await deleteImage(cur.imagePath)
    else if (form.get('removeImage') === '1') {
      await deleteImage(cur.imagePath)
      imagePath = null
    }
    db.update(prepLogs)
      .set({ date, slot, note, ...(imagePath !== undefined ? { imagePath } : {}) })
      .where(eq(prepLogs.id, id))
      .run()
    db.delete(prepItems).where(eq(prepItems.logId, id)).run()
  } else {
    const row = db
      .insert(prepLogs)
      .values({ userId: me.id, date, slot, note, imagePath: imagePath ?? null })
      .returning()
      .get()
    logId = row.id
    // 写了备菜记录 = 参与了这个餐次的备菜
    if (!hasRole(me.id, date, slot, 'prep'))
      toggleRole({ userId: me.id, date, slot, kind: 'prep', source: 'prep_log' })
  }
  for (const it of items) db.insert(prepItems).values({ logId: logId!, ...it }).run()

  refresh()
  return { ok: true, id: logId! }
}

/** 删除备菜记录：本人或管理员。由这条记录自动打上的「备菜」，在该餐次没有其他记录时一并取消 */
export async function deletePrepLog(id: string): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  const cur = db.select().from(prepLogs).where(eq(prepLogs.id, id)).get()
  if (!cur) return { ok: true }
  if (cur.userId !== me.id && !me.isAdmin) return { ok: false, error: t('err.onlyOwnLog') }
  await deleteImage(cur.imagePath)
  db.delete(prepLogs).where(eq(prepLogs.id, id)).run()

  if (cur.userId) {
    const others = db
      .select({ id: prepLogs.id })
      .from(prepLogs)
      .where(and(eq(prepLogs.userId, cur.userId), eq(prepLogs.date, cur.date), eq(prepLogs.slot, cur.slot)))
      .get()
    if (!others)
      db.delete(mealRoles)
        .where(
          and(
            eq(mealRoles.userId, cur.userId),
            eq(mealRoles.date, cur.date),
            eq(mealRoles.slot, cur.slot),
            eq(mealRoles.kind, 'prep'),
            eq(mealRoles.source, 'prep_log'),
          ),
        )
        .run()
  }
  refresh()
  return { ok: true }
}
