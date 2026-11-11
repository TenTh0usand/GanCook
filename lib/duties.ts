import 'server-only'
import { and, asc, eq, inArray, isNull, ne } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { mealRoles, meals, orders, prepLogs, users } from '@/lib/db/schema'
import type { MealType, DutyKind, ContribKind } from '@/lib/roles'

/**
 * 餐次分工（GanCook-10k 扩展）。
 * 一个「餐次」= 日期 + 时段；备菜 / 做菜 / 善后都记在餐次上，不依赖饭局。
 */

export type RolePerson = {
  userId: string
  name: string
  avatarPath: string | null
}

export type SlotRoles = Record<DutyKind, RolePerson[]>

/** 某餐次的分工（每种角色有哪些人，按打卡先后） */
export function getSlotRoles(date: string, slot: MealType): SlotRoles {
  const rows = db
    .select({
      kind: mealRoles.kind,
      userId: users.id,
      name: users.name,
      avatarPath: users.avatarPath,
    })
    .from(mealRoles)
    .innerJoin(users, eq(mealRoles.userId, users.id))
    .where(and(eq(mealRoles.date, date), eq(mealRoles.slot, slot)))
    .orderBy(asc(mealRoles.createdAt))
    .all()
  const res: SlotRoles = { prep: [], cook: [], clean: [] }
  for (const r of rows) res[r.kind].push({ userId: r.userId, name: r.name, avatarPath: r.avatarPath })
  return res
}

/**
 * 「我的」页用：几天内我每个餐次参与了哪些角色（含点菜，点菜按饭局日期 + 时段归类）。
 * 返回 { 'YYYY-MM-DD': { lunch: ['cook','order'], ... } }
 */
export function getMyDayRoles(
  userId: string,
  dates: string[],
): Record<string, Partial<Record<MealType, ContribKind[]>>> {
  const res: Record<string, Partial<Record<MealType, ContribKind[]>>> = {}
  for (const d of dates) res[d] = {}
  if (dates.length === 0) return res
  const roleRows = db
    .select({ date: mealRoles.date, slot: mealRoles.slot, kind: mealRoles.kind })
    .from(mealRoles)
    .where(and(eq(mealRoles.userId, userId), inArray(mealRoles.date, dates)))
    .all()
  for (const r of roleRows) (res[r.date][r.slot] ??= []).push(r.kind)

  const orderRows = db
    .selectDistinct({ date: meals.date, slot: meals.mealType })
    .from(orders)
    .innerJoin(meals, eq(orders.mealId, meals.id))
    .where(and(eq(orders.userId, userId), inArray(meals.date, dates)))
    .all()
  for (const r of orderRows) {
    const list = (res[r.date][r.slot] ??= [])
    if (!list.includes('order')) list.push('order')
  }
  return res
}

/** 某种角色在几天内的参与情况：{ date: { slot: [人...] } }（备菜页用） */
export function getKindByDates(
  kind: DutyKind,
  dates: string[],
): Record<string, Partial<Record<MealType, RolePerson[]>>> {
  const res: Record<string, Partial<Record<MealType, RolePerson[]>>> = {}
  for (const d of dates) res[d] = {}
  if (dates.length === 0) return res
  const rows = db
    .select({
      date: mealRoles.date,
      slot: mealRoles.slot,
      userId: users.id,
      name: users.name,
      avatarPath: users.avatarPath,
    })
    .from(mealRoles)
    .innerJoin(users, eq(mealRoles.userId, users.id))
    .where(and(eq(mealRoles.kind, kind), inArray(mealRoles.date, dates)))
    .orderBy(asc(mealRoles.createdAt))
    .all()
  for (const r of rows)
    (res[r.date][r.slot] ??= []).push({ userId: r.userId, name: r.name, avatarPath: r.avatarPath })
  return res
}

/** 一批餐次的做菜人姓名（饭局列表卡片用），key = `${date}|${slot}` */
export function getCookNamesBySlot(dates: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  if (dates.length === 0) return map
  const rows = db
    .select({ date: mealRoles.date, slot: mealRoles.slot, name: users.name })
    .from(mealRoles)
    .innerJoin(users, eq(mealRoles.userId, users.id))
    .where(and(eq(mealRoles.kind, 'cook'), inArray(mealRoles.date, [...new Set(dates)])))
    .orderBy(asc(mealRoles.createdAt))
    .all()
  for (const r of rows) {
    const k = `${r.date}|${r.slot}`
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(r.name)
  }
  return map
}

/** 该餐次是否已有某人的某角色 */
export function hasRole(userId: string, date: string, slot: MealType, kind: DutyKind): boolean {
  return !!db
    .select({ id: mealRoles.id })
    .from(mealRoles)
    .where(
      and(
        eq(mealRoles.userId, userId),
        eq(mealRoles.date, date),
        eq(mealRoles.slot, slot),
        eq(mealRoles.kind, kind),
      ),
    )
    .get()
}

/** 找该餐次第一个未取消的饭局（用于自动关联） */
export function findMealForSlot(date: string, slot: MealType): string | null {
  const row = db
    .select({ id: meals.id })
    .from(meals)
    .where(and(eq(meals.date, date), eq(meals.mealType, slot), ne(meals.status, 'cancelled')))
    .orderBy(asc(meals.createdAt))
    .get()
  return row?.id ?? null
}

/**
 * 打卡 / 取消打卡（有就删、没有就加）。只操作 userId 本人的记录。
 * 返回操作后的状态：true = 已参与
 */
export function toggleRole(input: {
  userId: string
  date: string
  slot: MealType
  kind: DutyKind
  source: 'manual' | 'meal' | 'prep_log'
  mealId?: string | null
}): boolean {
  const { userId, date, slot, kind } = input
  const existing = db
    .select({ id: mealRoles.id })
    .from(mealRoles)
    .where(
      and(
        eq(mealRoles.userId, userId),
        eq(mealRoles.date, date),
        eq(mealRoles.slot, slot),
        eq(mealRoles.kind, kind),
      ),
    )
    .get()

  if (existing) {
    db.delete(mealRoles).where(eq(mealRoles.id, existing.id)).run()
  } else {
    db.insert(mealRoles)
      .values({
        userId,
        date,
        slot,
        kind,
        source: input.source,
        mealId: input.mealId ?? findMealForSlot(date, slot),
      })
      .onConflictDoNothing()
      .run()
  }
  if (kind === 'cook') syncMealCooks(date, slot)
  return !existing
}

/**
 * 兼容原「掌勺人」字段：把该餐次所有饭局的 meals.cookId 同步为第一个做菜的人。
 * 老页面 / 老逻辑仍然读 cookId，不会坏。
 */
export function syncMealCooks(date: string, slot: MealType) {
  const first = db
    .select({ userId: mealRoles.userId })
    .from(mealRoles)
    .where(and(eq(mealRoles.date, date), eq(mealRoles.slot, slot), eq(mealRoles.kind, 'cook')))
    .orderBy(asc(mealRoles.createdAt))
    .get()
  db.update(meals)
    .set({ cookId: first?.userId ?? null })
    .where(and(eq(meals.date, date), eq(meals.mealType, slot)))
    .run()
}

/** 新建饭局后：把该餐次已有的分工和备菜记录关联到该饭局，并同步掌勺人 */
export function linkSlotToMeal(date: string, slot: MealType, mealId: string) {
  db.update(mealRoles)
    .set({ mealId })
    .where(and(eq(mealRoles.date, date), eq(mealRoles.slot, slot), isNull(mealRoles.mealId)))
    .run()
  db.update(prepLogs)
    .set({ mealId })
    .where(and(eq(prepLogs.date, date), eq(prepLogs.slot, slot), isNull(prepLogs.mealId)))
    .run()
  syncMealCooks(date, slot)
}

/** 删除饭局时：清掉通过该饭局「我也来做」产生的做菜记录（手动打卡的保留） */
export function removeMealSourcedRoles(mealId: string) {
  const meal = db.select().from(meals).where(eq(meals.id, mealId)).get()
  db.delete(mealRoles)
    .where(and(eq(mealRoles.mealId, mealId), eq(mealRoles.source, 'meal')))
    .run()
  if (meal) syncMealCooks(meal.date, meal.mealType)
}
