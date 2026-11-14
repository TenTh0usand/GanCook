'use server'

import { revalidatePath } from 'next/cache'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { mealCompanions, meals, users, venues } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/user'
import { getMeal } from '@/lib/meals'
import { getT } from '@/lib/i18n/server'
import { isOutCategory } from '@/lib/roles'
import type { ActionResult } from '@/lib/actions/meals'

function revalidateMeal(id: string) {
  revalidatePath(`/meals/${id}`)
  revalidatePath('/meals')
  revalidatePath('/home')
  revalidatePath('/stats')
  revalidatePath('/dishes')
}

/** 切换「在家 / 外出」（全家都能切、任何时候都能切；已点的菜保留，只是不显示） */
export async function setMealKind(id: string, kind: 'home' | 'out'): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  if (kind !== 'home' && kind !== 'out') return { ok: false, error: t('err.badInput') }
  const meal = getMeal(id)
  if (!meal) return { ok: false, error: t('err.mealNotFound') }
  db.update(meals).set({ kind }).where(eq(meals.id, id)).run()
  revalidateMeal(id)
  return { ok: true }
}

/** 宽松解析金额：「85」「85.5」「¥85」「85元」都行；看不懂就当没填 */
function toCents(v: unknown): number | null {
  if (v == null) return null
  const n = parseFloat(String(v).replace(/[^\d.]/g, ''))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(Math.round(n * 100), 100_000_000)
}

function toInt(v: unknown): number | null {
  const n = parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? Math.min(n, 999) : null
}

/** 保存外出记录（全部可以不填；我家实付不填 = 总价） */
export async function saveOuting(
  id: string,
  input: {
    venueName?: string
    category?: string | null
    total?: string
    headcount?: string
    paid?: string
    companions?: string[]
  },
): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  const meal = getMeal(id)
  if (!meal) return { ok: false, error: t('err.mealNotFound') }

  const name = (input.venueName ?? '').trim().replace(/\s+/g, ' ').slice(0, 30)
  const totalCents = toCents(input.total)
  const paidCents = toCents(input.paid) ?? totalCents
  const headcount = toInt(input.headcount)
  const category = isOutCategory(input.category) ? input.category : null
  const wanted = [...new Set((input.companions ?? []).filter((x) => typeof x === 'string'))].slice(0, 50)

  db.transaction(() => {
    let venueId: string | null = null
    if (name) {
      const found = db.select({ id: venues.id }).from(venues).where(eq(venues.name, name)).get()
      venueId = found?.id ?? db.insert(venues).values({ name }).returning({ id: venues.id }).get().id
    }
    db.update(meals)
      .set({ kind: 'out', venueId, outCategory: category, totalCents, paidCents, headcount })
      .where(eq(meals.id, id))
      .run()
    db.delete(mealCompanions).where(eq(mealCompanions.mealId, id)).run()
    if (wanted.length) {
      const valid = db.select({ id: users.id }).from(users).where(inArray(users.id, wanted)).all()
      if (valid.length) db.insert(mealCompanions).values(valid.map((u) => ({ mealId: id, userId: u.id }))).run()
    }
  })
  revalidateMeal(id)
  return { ok: true }
}
