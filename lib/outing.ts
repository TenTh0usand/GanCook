import 'server-only'
import { asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { mealCompanions, meals, users, venues } from '@/lib/db/schema'
import type { OutCategory } from '@/lib/roles'

/** 外出信息（饭局卡片 / 详情页用；金额单位：分） */
export type OutingInfo = {
  venueName: string | null
  category: OutCategory | null
  totalCents: number | null
  headcount: number | null
  paidCents: number | null
  /** 人均（分）：总价 ÷ 人数，缺一项就是 null */
  perCents: number | null
  companions: { id: string; name: string; avatarPath: string | null }[]
}

/** 一批外出饭局的外出信息 */
export function getOutingInfo(mealIds: string[]): Map<string, OutingInfo> {
  const map = new Map<string, OutingInfo>()
  if (mealIds.length === 0) return map
  const rows = db
    .select({
      id: meals.id,
      venueName: venues.name,
      category: meals.outCategory,
      totalCents: meals.totalCents,
      headcount: meals.headcount,
      paidCents: meals.paidCents,
    })
    .from(meals)
    .leftJoin(venues, eq(meals.venueId, venues.id))
    .where(inArray(meals.id, mealIds))
    .all()
  for (const r of rows) {
    map.set(r.id, {
      venueName: r.venueName ?? null,
      category: r.category ?? null,
      totalCents: r.totalCents,
      headcount: r.headcount,
      paidCents: r.paidCents,
      perCents: r.totalCents != null && r.headcount ? Math.round(r.totalCents / r.headcount) : null,
      companions: [],
    })
  }
  const comp = db
    .select({ mealId: mealCompanions.mealId, id: users.id, name: users.name, avatarPath: users.avatarPath })
    .from(mealCompanions)
    .innerJoin(users, eq(mealCompanions.userId, users.id))
    .where(inArray(mealCompanions.mealId, mealIds))
    .orderBy(asc(users.createdAt))
    .all()
  for (const c of comp) map.get(c.mealId)?.companions.push({ id: c.id, name: c.name, avatarPath: c.avatarPath })
  return map
}

/** 去过的店名（联想用，按最近添加排在前面） */
export function listVenueNames(): string[] {
  return db
    .select({ name: venues.name })
    .from(venues)
    .all()
    .map((v) => v.name)
    .reverse()
}

/** 金额显示：分 → 「85」「85.5」 */
export function fmtYuan(cents: number): string {
  const y = cents / 100
  return Number.isInteger(y) ? String(y) : y.toFixed(2).replace(/0$/, '')
}
