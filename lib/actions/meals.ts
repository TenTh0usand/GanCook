'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { meals, orders } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/user'
import { getSettings } from '@/lib/settings'
import { getMeal } from '@/lib/meals'
import { localDateTimeToSec, nowSec } from '@/lib/time'
import { getT } from '@/lib/i18n/server'
import { hasRole, linkSlotToMeal, removeMealSourcedRoles, toggleRole } from '@/lib/duties'
import { isMealType, type MealType } from '@/lib/roles'

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string }

const reDate = /^\d{4}-\d{2}-\d{2}$/
const reTime = /^\d{2}:\d{2}$/

export async function createMeal(input: {
  mealType: MealType
  date: string
  diningTime: string
  deadline: string
  title?: string
}): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }

  if (!isMealType(input.mealType)) return { ok: false, error: t('err.badInput') }
  if (!reDate.test(input.date)) return { ok: false, error: t('err.dateFmt') }
  if (!reTime.test(input.diningTime) || !reTime.test(input.deadline))
    return { ok: false, error: t('err.timeFmt') }

  const tz = getSettings().timezone
  const diningSec = localDateTimeToSec(input.date, input.diningTime, tz)
  const rawDeadlineSec = localDateTimeToSec(input.date, input.deadline, tz)
  const deadlineSec = Math.min(rawDeadlineSec, diningSec)

  const row = db.transaction(() => {
    const created = db
      .insert(meals)
      .values({
        title: input.title?.trim().slice(0, 30) || null,
        mealType: input.mealType,
        date: input.date,
        diningTime: diningSec,
        orderDeadline: deadlineSec,
        status: 'ordering',
        isAuto: false,
        createdBy: me.id,
      })
      .returning()
      .get()
    linkSlotToMeal(input.date, input.mealType, created.id)
    return created
  })
  revalidatePath('/meals')
  revalidatePath('/home')
  return { ok: true, id: row.id }
}

export async function deleteMeal(id: string): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  const meal = getMeal(id)
  if (!meal) return { ok: true }
  if (meal.createdBy !== me.id && !me.isAdmin)
    return { ok: false, error: t('err.onlyCreatorMeal') }
  db.transaction(() => {
    removeMealSourcedRoles(id)
    db.delete(meals).where(eq(meals.id, id)).run()
  })
  revalidatePath('/meals')
  revalidatePath('/home')
  revalidatePath('/dishes')
  revalidatePath('/stats')
  revalidatePath('/me')
  return { ok: true }
}

/**
 * 「我也来做 / 我不做了」（GanCook-10k：一个餐次可多人做菜）。
 * 做菜记录写在 meal_roles 上；meals.cookId 自动同步为第一个做菜的人。
 */
export async function toggleCook(id: string): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  const meal = getMeal(id)
  if (!meal) return { ok: false, error: t('err.mealNotFound') }
  toggleRole({
    userId: me.id,
    date: meal.date,
    slot: meal.mealType,
    kind: 'cook',
    source: 'meal',
    mealId: meal.id,
  })
  revalidatePath(`/meals/${id}`)
  revalidatePath('/meals')
  revalidatePath('/home')
  revalidatePath('/me')
  revalidatePath('/stats')
  return { ok: true }
}

export async function setMealStatus(
  id: string,
  status: 'ordering' | 'cooking' | 'done' | 'cancelled',
): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  const meal = getMeal(id)
  if (!meal) return { ok: false, error: t('err.mealNotFound') }
  const allowed =
    me.isAdmin ||
    meal.createdBy === me.id ||
    meal.cookId === me.id ||
    hasRole(me.id, meal.date, meal.mealType, 'cook')
  if (!allowed) return { ok: false, error: t('err.cookOrAdmin') }
  db.update(meals).set({ status }).where(eq(meals.id, id)).run()
  revalidatePath(`/meals/${id}`)
  revalidatePath('/meals')
  revalidatePath('/home')
  revalidatePath('/dishes')
  revalidatePath('/stats')
  return { ok: true }
}

/** 点 / 取消点 一道菜（仅在点菜开放且未截止时） */
export async function toggleOrder(
  mealId: string,
  dishId: string,
): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  const meal = getMeal(mealId)
  if (!meal) return { ok: false, error: t('err.mealNotFound') }
  if (meal.status !== 'ordering' || nowSec() >= meal.orderDeadline)
    return { ok: false, error: t('err.orderClosed') }

  const existing = db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.mealId, mealId),
        eq(orders.dishId, dishId),
        eq(orders.userId, me.id),
      ),
    )
    .get()

  if (existing) {
    db.delete(orders).where(eq(orders.id, existing.id)).run()
  } else {
    db.insert(orders)
      .values({ mealId, dishId, userId: me.id })
      .run()
  }
  revalidatePath(`/meals/${mealId}`)
  revalidatePath(`/meals/${mealId}/order`)
  revalidatePath('/meals')
  revalidatePath('/home')
  revalidatePath('/me')
  revalidatePath('/stats')
  return { ok: true }
}
