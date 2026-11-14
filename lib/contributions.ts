import 'server-only'
import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { mealRoles, meals, orders } from '@/lib/db/schema'
import { listMembers } from '@/lib/auth/user'
import { getSettings } from '@/lib/settings'
import { dayjs, todayLocal } from '@/lib/time'
import { CONTRIB_KINDS, type ContribKind } from '@/lib/roles'

/**
 * 家务贡献统计（GanCook-10k 改造：四种角色）。
 *
 * 计数口径（热力图每格 = 一天）：
 * - 备菜 / 善后：每人每天只要参与过一次就记 1（按天去重）；原始逐餐次记录保留在 raw 里
 * - 做菜：当天参与做菜的餐次数（关联的饭局若已取消 / 还在点菜中则暂不计）
 * - 点菜：当天下单参与的饭局数（沿用原逻辑；以后外出就餐不计入）
 */
export type MemberContribution = {
  id: string
  name: string
  avatarPath: string | null
  /** 每种角色：日期 → 当天计数（用于热力图） */
  byDate: Record<ContribKind, Record<string, number>>
  /** 每种角色：日期 → 原始餐次数（仅备菜 / 善后有意义，悬停提示用） */
  raw: Record<ContribKind, Record<string, number>>
  /** 每种角色的总数（备菜 / 善后 = 天数，其余 = 次数） */
  totals: Record<ContribKind, number>
  streak: number // 连续活跃天数（任意角色）
}

function emptyKinds<T>(make: () => T): Record<ContribKind, T> {
  return Object.fromEntries(CONTRIB_KINDS.map((k) => [k, make()])) as Record<ContribKind, T>
}

/** 当前连续活跃天数：从今天（今天没有就从昨天）往前数 */
function currentStreak(active: Set<string>, today: string): number {
  let streak = 0
  let d = dayjs(today)
  if (!active.has(d.format('YYYY-MM-DD'))) {
    if (active.has(d.subtract(1, 'day').format('YYYY-MM-DD'))) d = d.subtract(1, 'day')
    else return 0
  }
  while (active.has(d.format('YYYY-MM-DD'))) {
    streak++
    d = d.subtract(1, 'day')
  }
  return streak
}

export function getContributions(): {
  members: MemberContribution[]
  today: string
  weeks: number
} {
  const tz = getSettings().timezone
  const today = todayLocal(tz)
  const weeks = 18 // 13px 格子 × 18 周 ≈ 卡片满宽，手机上整图免横向滚动

  const members = listMembers()
  if (members.length === 0) return { members: [], today, weeks }

  // 每人每角色：日期 → 餐次集合（去重用）
  const slotSets = new Map<string, Record<ContribKind, Map<string, Set<string>>>>()
  const bucket = (userId: string) => {
    if (!slotSets.has(userId)) slotSets.set(userId, emptyKinds(() => new Map()))
    return slotSets.get(userId)!
  }
  const add = (userId: string, kind: ContribKind, date: string, key: string) => {
    const byDay = bucket(userId)[kind]
    if (!byDay.has(date)) byDay.set(date, new Set())
    byDay.get(date)!.add(key)
  }

  // 备菜 / 做菜 / 善后：来自 meal_roles。
  // 关联饭局已取消、或还在点菜中的「做菜」暂不计（和原逻辑一致：做了才算）
  const roleRows = db
    .select({
      userId: mealRoles.userId,
      date: mealRoles.date,
      slot: mealRoles.slot,
      kind: mealRoles.kind,
      mealStatus: meals.status,
    })
    .from(mealRoles)
    .leftJoin(meals, eq(mealRoles.mealId, meals.id))
    .where(
      or(
        inArray(mealRoles.kind, ['prep', 'clean']),
        isNull(mealRoles.mealId),
        and(eq(mealRoles.kind, 'cook'), inArray(meals.status, ['cooking', 'done'])),
      ),
    )
    .all()
  for (const r of roleRows) {
    if (r.kind === 'cook' && r.mealStatus && !['cooking', 'done'].includes(r.mealStatus)) continue
    add(r.userId, r.kind, r.date, r.slot)
  }

  // 点菜：按下单当天（家庭时区）计参与的饭局数
  const orderRows = db
    .select({ userId: orders.userId, mealId: orders.mealId, createdAt: orders.createdAt })
    .from(orders)
    .innerJoin(meals, eq(orders.mealId, meals.id))
    .where(eq(meals.kind, 'home')) // P5：外出不算点菜贡献
    .all()
  for (const r of orderRows) {
    const day = dayjs.unix(r.createdAt).tz(tz).format('YYYY-MM-DD')
    add(r.userId, 'order', day, r.mealId)
  }

  const result: MemberContribution[] = members.map((m) => {
    const sets = slotSets.get(m.id) ?? emptyKinds(() => new Map<string, Set<string>>())
    const byDate = emptyKinds<Record<string, number>>(() => ({}))
    const raw = emptyKinds<Record<string, number>>(() => ({}))
    const totals = emptyKinds(() => 0)
    const active = new Set<string>()
    for (const kind of CONTRIB_KINDS) {
      for (const [day, set] of sets[kind]) {
        const n = set.size
        const daily = kind === 'prep' || kind === 'clean' ? 1 : n
        byDate[kind][day] = daily
        raw[kind][day] = n
        totals[kind] += daily
        active.add(day)
      }
    }
    return {
      id: m.id,
      name: m.name,
      avatarPath: m.avatarPath,
      byDate,
      raw,
      totals,
      streak: currentStreak(active, today),
    }
  })

  const sum = (m: MemberContribution) => CONTRIB_KINDS.reduce((a, k) => a + m.totals[k], 0)
  result.sort((a, b) => sum(b) - sum(a) || b.totals.cook - a.totals.cook)

  return { members: result, today, weeks }
}
