import 'server-only'
import { eq, and, desc, asc, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { meals, orders, dishes, users, reviews } from '@/lib/db/schema'
import type { Meal } from '@/lib/db/schema'
import type { ScoreDim } from '@/lib/scoring'

export type OrderDetail = {
  id: string
  note: string | null
  userId: string
  userName: string
  userAvatar: string | null
  dishId: string
  dishName: string
  dishImage: string | null
}

export type ReviewDetail = {
  id: string
  rating: number
  comment: string | null
  /** GanCook-10k（P3）：分数 ×10、评分方式、科学评分维度 */
  scoreX10: number | null
  mode: 'simple' | 'sci'
  dims: Partial<Record<ScoreDim, number>> | null
  userId: string
  userName: string
  userAvatar: string | null
}

export type MealDetail = {
  meal: Meal
  orders: OrderDetail[]
  reviews: ReviewDetail[]
}

export function getMeal(id: string): Meal | undefined {
  return db.select().from(meals).where(eq(meals.id, id)).get()
}

export function getMealDetail(id: string): MealDetail | null {
  const meal = getMeal(id)
  if (!meal) return null

  const orderRows = db
    .select({
      id: orders.id,
      note: orders.note,
      userId: users.id,
      userName: users.name,
      userAvatar: users.avatarPath,
      dishId: dishes.id,
      dishName: dishes.name,
      dishImage: dishes.imagePath,
    })
    .from(orders)
    .innerJoin(users, eq(orders.userId, users.id))
    .innerJoin(dishes, eq(orders.dishId, dishes.id))
    .where(eq(orders.mealId, id))
    .orderBy(asc(orders.createdAt))
    .all()

  const reviewRows = db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      scoreX10: reviews.scoreX10,
      mode: reviews.mode,
      dims: reviews.dims,
      userId: users.id,
      userName: users.name,
      userAvatar: users.avatarPath,
    })
    .from(reviews)
    .innerJoin(users, eq(reviews.userId, users.id))
    .where(eq(reviews.mealId, id))
    .orderBy(asc(reviews.createdAt))
    .all()

  return { meal, orders: orderRows, reviews: reviewRows }
}

export function listMeals(): Meal[] {
  return db.select().from(meals).orderBy(desc(meals.diningTime)).all()
}

/** 一批饭局各自点了哪些菜（去重，按首次点菜时间排序），饭局卡片 / 历史搜索用 */
export function getMealDishNames(mealIds: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  if (mealIds.length === 0) return map
  const rows = db
    .select({ mealId: orders.mealId, name: dishes.name })
    .from(orders)
    .innerJoin(dishes, eq(orders.dishId, dishes.id))
    .where(inArray(orders.mealId, mealIds))
    .orderBy(asc(orders.createdAt))
    .all()
  for (const r of rows) {
    const list = map.get(r.mealId) ?? []
    if (!list.includes(r.name)) list.push(r.name)
    map.set(r.mealId, list)
  }
  return map
}

/** 一批饭局的点菜人数（SQL GROUP BY 去重统计） */
export function getMealParticipantCounts(mealIds: string[]): Map<string, number> {
  const map = new Map<string, number>()
  if (mealIds.length === 0) return map
  const rows = db
    .select({
      mealId: orders.mealId,
      count: sql<number>`count(distinct ${orders.userId})`,
    })
    .from(orders)
    .where(inArray(orders.mealId, mealIds))
    .groupBy(orders.mealId)
    .all()
  for (const r of rows) map.set(r.mealId, Number(r.count))
  return map
}

/** GanCook-10k（P3）：每顿饭的全家平均分（×10），饭局卡片用 */
export function getMealScores(mealIds?: string[]): Map<string, { avg: number; n: number }> {
  if (mealIds && mealIds.length === 0) return new Map()
  const base = db
    .select({ mealId: reviews.mealId, score: reviews.scoreX10, rating: reviews.rating })
    .from(reviews)
  const rows = mealIds ? base.where(inArray(reviews.mealId, mealIds)).all() : base.all()
  const acc = new Map<string, { sum: number; n: number }>()
  for (const r of rows) {
    const v = r.score ?? r.rating * 10
    const a = acc.get(r.mealId) ?? { sum: 0, n: 0 }
    a.sum += v
    a.n++
    acc.set(r.mealId, a)
  }
  return new Map([...acc].map(([k, a]) => [k, { avg: Math.round(a.sum / a.n), n: a.n }]))
}

/** 我在某饭局点的菜 id 集合 */
export function myOrderedDishIds(mealId: string, userId: string): Set<string> {
  const rows = db
    .select({ dishId: orders.dishId })
    .from(orders)
    .where(and(eq(orders.mealId, mealId), eq(orders.userId, userId)))
    .all()
  return new Set(rows.map((r) => r.dishId))
}
