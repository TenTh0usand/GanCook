import 'server-only'
import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { prepItems, prepLogs, users } from '@/lib/db/schema'
import type { MealType } from '@/lib/roles'

/**
 * 备菜记录查询（GanCook-10k · P4）。
 */

export type PrepItemView = {
  id: string
  name: string
  source: 'bought' | 'fridge' | 'other'
  qty: string | null
  priceCents: number | null
}

export type PrepLogView = {
  id: string
  date: string
  slot: MealType
  note: string | null
  imagePath: string | null
  createdAt: number
  userId: string | null
  userName: string | null
  userAvatar: string | null
  items: PrepItemView[]
  totalCents: number
}

function attachItems(
  logs: Omit<PrepLogView, 'items' | 'totalCents'>[],
): PrepLogView[] {
  if (logs.length === 0) return []
  const items = db
    .select()
    .from(prepItems)
    .where(inArray(prepItems.logId, logs.map((l) => l.id)))
    .orderBy(asc(prepItems.sort))
    .all()
  const byLog = new Map<string, PrepItemView[]>()
  for (const it of items) {
    if (!byLog.has(it.logId)) byLog.set(it.logId, [])
    byLog.get(it.logId)!.push({
      id: it.id,
      name: it.name,
      source: it.source,
      qty: it.qty,
      priceCents: it.priceCents,
    })
  }
  return logs.map((l) => {
    const its = byLog.get(l.id) ?? []
    return { ...l, items: its, totalCents: its.reduce((a, i) => a + (i.priceCents ?? 0), 0) }
  })
}

/** 某天的备菜记录（按餐次、时间排） */
export function getPrepLogsByDate(date: string): PrepLogView[] {
  const rows = db
    .select({
      id: prepLogs.id,
      date: prepLogs.date,
      slot: prepLogs.slot,
      note: prepLogs.note,
      imagePath: prepLogs.imagePath,
      createdAt: prepLogs.createdAt,
      userId: prepLogs.userId,
      userName: users.name,
      userAvatar: users.avatarPath,
    })
    .from(prepLogs)
    .leftJoin(users, eq(prepLogs.userId, users.id))
    .where(eq(prepLogs.date, date))
    .orderBy(asc(prepLogs.createdAt))
    .all()
  return attachItems(rows)
}

/** 一段日期内记录了价格的买菜花费合计（分），在家花费统计用 */
export function getPrepSpend(from: string, to: string): number {
  const rows = db
    .select({ price: prepItems.priceCents })
    .from(prepItems)
    .innerJoin(prepLogs, eq(prepItems.logId, prepLogs.id))
    .where(and(gte(prepLogs.date, from), lte(prepLogs.date, to)))
    .all()
  return rows.reduce((a, r) => a + (r.price ?? 0), 0)
}

/** 最近用过的食材名（输入联想用），按使用次数排 */
export function getRecentItemNames(limit = 60): string[] {
  const rows = db
    .select({ name: prepItems.name })
    .from(prepItems)
    .innerJoin(prepLogs, eq(prepItems.logId, prepLogs.id))
    .orderBy(desc(prepLogs.createdAt))
    .limit(500)
    .all()
  const count = new Map<string, number>()
  for (const r of rows) count.set(r.name, (count.get(r.name) ?? 0) + 1)
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([n]) => n)
}

/** 价格文字 → 分：「58」「58.5」「¥12.80」都行；不合法返回 null */
export function parsePriceCents(text: string | null | undefined): number | null {
  if (!text) return null
  const v = Number(String(text).replace(/[¥￥元\s,，]/g, ''))
  if (!Number.isFinite(v) || v <= 0) return null
  return Math.round(v * 100)
}
