import 'server-only'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import {
  dishes,
  dishCategories,
  dishCookLogs,
  meals,
  menuFeatures,
  orders,
} from '@/lib/db/schema'
import type { Dish, DishCategory } from '@/lib/db/schema'
import { getSettings } from '@/lib/settings'
import { dayjs, todayLocal } from '@/lib/time'
import {
  HOME_MIN_COOKS,
  HOME_RECENT_DAYS,
  MENUS,
  NEW_DAYS,
  SEASONAL_DAYS,
  SEASONAL_LIMIT,
  TOP_LIMIT,
  type BrowserDish,
  type BrowserMenu,
  type BrowserPoster,
  type BrowserSection,
  type MenuBrowserData,
  type MenuId,
} from '@/lib/menu-config'

/**
 * 菜单数据（GanCook-10k · P2）：做过次数、菜单收录、分组排序、时令推荐。
 * 做过次数不单独存，每次从「已完成的饭局 + 手动我做过」实时算。
 */

export type CookStat = {
  /** 总做过次数 */
  total: number
  /** 最近 HOME_RECENT_DAYS 天的次数 */
  recent: number
  /** 最近一次做的日期 */
  last: string | null
}

/** 菜品 + 统计信息（页面直接用） */
export type MenuDish = Dish & {
  cook: CookStat
  isNew: boolean
}

export type MenuSection = {
  /** 分类 id；虚拟分组为 '__top' / '__seasonal' */
  id: string
  name: string
  badge: string | null
  dishes: MenuDish[]
  /** 完整菜单：大类内按细类分的小标题 */
  groups?: { id: string; name: string; dishes: MenuDish[] }[]
}

export type BuiltMenu = {
  id: MenuId
  sections: MenuSection[]
  /** 家常菜单一道都没收录时为 true（页面显示全部菜 + 提示去标精选） */
  fallbackAll: boolean
}

const OTHER = 'other'

/** 每道菜的做过次数：已完成饭局里出现过（一顿只算 1 次）+ 手动「我做过」记录 */
export function getCookStats(): Map<string, CookStat> {
  const tz = getSettings().timezone
  const since = dayjs(todayLocal(tz)).subtract(HOME_RECENT_DAYS, 'day').format('YYYY-MM-DD')
  const stats = new Map<string, CookStat>()
  const bump = (dishId: string, date: string) => {
    const s = stats.get(dishId) ?? { total: 0, recent: 0, last: null }
    s.total++
    if (date >= since) s.recent++
    if (!s.last || date > s.last) s.last = date
    stats.set(dishId, s)
  }

  // 已完成饭局：同一顿里多人点同一道菜只算 1 次
  // （P5 加入外出饭局后，这里要再加 meals.kind = 'home' 条件）
  const mealRows = db
    .selectDistinct({ dishId: orders.dishId, mealId: orders.mealId, date: meals.date })
    .from(orders)
    .innerJoin(meals, eq(orders.mealId, meals.id))
    .where(eq(meals.status, 'done'))
    .all()
  for (const r of mealRows) bump(r.dishId, r.date)

  const logRows = db
    .select({ dishId: dishCookLogs.dishId, date: dishCookLogs.date })
    .from(dishCookLogs)
    .all()
  for (const r of logRows) bump(r.dishId, r.date)

  return stats
}

export function listCategories(): DishCategory[] {
  return db.select().from(dishCategories).orderBy(asc(dishCategories.sort)).all()
}

/** 所有在售菜 + 统计，按做过次数从多到少（再按名字）排好 */
export function getMenuDishes(): MenuDish[] {
  const stats = getCookStats()
  const newSince = dayjs().subtract(NEW_DAYS, 'day').unix()
  const empty: CookStat = { total: 0, recent: 0, last: null }
  return db
    .select()
    .from(dishes)
    .where(eq(dishes.status, 'active'))
    .all()
    .map((d) => ({ ...d, cook: stats.get(d.id) ?? empty, isNew: d.createdAt >= newSince }))
    .sort(byCooked)
}

function byCooked(a: MenuDish, b: MenuDish): number {
  return b.cook.total - a.cook.total || a.name.localeCompare(b.name, 'zh-CN')
}

/** 家常菜单收录规则：手动标了家常精选，或最近 3 个月做过 ≥ 2 次 */
export function inHomeMenu(d: MenuDish): boolean {
  return d.pinned || d.cook.recent >= HOME_MIN_COOKS
}

/**
 * 时令推荐：管理员指定的（在有效期内）优先；没有就取最近 3 个月做得最多的，
 * 再没有就取历史上做得最多的。
 */
export function getSeasonal(all: MenuDish[]): { dishes: MenuDish[]; auto: boolean } {
  const tz = getSettings().timezone
  const today = todayLocal(tz)
  const byId = new Map(all.map((d) => [d.id, d]))
  const featured = db
    .select()
    .from(menuFeatures)
    .orderBy(asc(menuFeatures.sort), asc(menuFeatures.createdAt))
    .all()
    .filter((f) => (!f.startDate || f.startDate <= today) && (!f.endDate || f.endDate >= today))
    .map((f) => byId.get(f.dishId))
    .filter((d): d is MenuDish => !!d)
  if (featured.length > 0) return { dishes: featured, auto: false }

  const recentSince = dayjs(today).subtract(SEASONAL_DAYS, 'day').format('YYYY-MM-DD')
  const recent = all
    .filter((d) => d.cook.recent > 0 && d.cook.last && d.cook.last >= recentSince)
    .sort((a, b) => b.cook.recent - a.cook.recent || byCooked(a, b))
  if (recent.length > 0) return { dishes: recent.slice(0, SEASONAL_LIMIT), auto: true }
  return { dishes: all.filter((d) => d.cook.total > 0).slice(0, SEASONAL_LIMIT), auto: true }
}

/** 组装一个菜单：顶部「本季推荐」「常做 TOP」+ 按大类分组（完整菜单再按细类分小标题） */
export function buildMenu(menuId: MenuId, all: MenuDish[], categories: DishCategory[]): BuiltMenu {
  const def = MENUS.find((m) => m.id === menuId) ?? MENUS[0]
  let list = def.include === 'home' ? all.filter(inHomeMenu) : all
  let fallbackAll = false
  if (def.include === 'home' && list.length === 0 && all.length > 0) {
    list = all
    fallbackAll = true
  }

  const sections: MenuSection[] = []
  const seasonal = getSeasonal(all).dishes.filter((d) => list.includes(d))
  if (seasonal.length > 0)
    sections.push({ id: '__seasonal', name: '', badge: null, dishes: seasonal })
  const top = list.filter((d) => d.cook.total > 0).slice(0, TOP_LIMIT)
  if (top.length > 0) sections.push({ id: '__top', name: '', badge: 'TOP', dishes: top })

  const parents = categories.filter((c) => !c.parentId)
  const known = new Set(categories.map((c) => c.id))
  for (const p of parents) {
    const inCat = list.filter((d) =>
      p.id === OTHER ? !d.category || !known.has(d.category) || d.category === OTHER : d.category === p.id,
    )
    if (inCat.length === 0) continue
    const section: MenuSection = { id: p.id, name: p.name, badge: p.badge, dishes: inCat }
    if (def.subgroups) {
      const subs = categories.filter((c) => c.parentId === p.id)
      const groups = subs
        .map((s) => ({ id: s.id, name: s.name, dishes: inCat.filter((d) => d.subcategory === s.id) }))
        .filter((g) => g.dishes.length > 0)
      const rest = inCat.filter((d) => !d.subcategory || !subs.some((s) => s.id === d.subcategory))
      if (groups.length > 0) {
        if (rest.length > 0) groups.push({ id: `${p.id}__rest`, name: '', dishes: rest })
        section.groups = groups
      }
    }
    sections.push(section)
  }
  return { id: def.id, sections, fallbackAll }
}

/** 某道菜的手动「我做过」记录（最近的在前） */
export function getCookLogs(dishId: string) {
  return db
    .select()
    .from(dishCookLogs)
    .where(eq(dishCookLogs.dishId, dishId))
    .orderBy(asc(dishCookLogs.date))
    .all()
    .reverse()
}

/** 一批菜的手动记录（菜品页批量用），dishId → 记录列表 */
export function getCookLogsFor(dishIds: string[]) {
  const map = new Map<string, { id: string; date: string; userId: string | null }[]>()
  if (dishIds.length === 0) return map
  const rows = db
    .select({
      id: dishCookLogs.id,
      dishId: dishCookLogs.dishId,
      date: dishCookLogs.date,
      userId: dishCookLogs.userId,
    })
    .from(dishCookLogs)
    .where(and(inArray(dishCookLogs.dishId, dishIds)))
    .all()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
  for (const r of rows) {
    if (!map.has(r.dishId)) map.set(r.dishId, [])
    map.get(r.dishId)!.push({ id: r.id, date: r.date, userId: r.userId })
  }
  return map
}


/* ───────── 菜单浏览组件的数据（P2 第 2 步） ───────── */

type TFn = (key: string, vars?: Record<string, string | number>) => string

/**
 * 组装菜单浏览组件需要的全部数据：所有菜单的分组（只存菜 id）、菜品字典、时令海报。
 * 「本季推荐」由顶部海报展示，列表里不再重复出现。
 */
export function getMenuBrowserData(t: TFn, opts: { includeArchived?: boolean } = {}): MenuBrowserData {
  const categories = listCategories()
  const all = getMenuDishes()
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? null
  const dishMap: Record<string, BrowserDish> = {}
  const put = (d: Dish, cook: CookStat, isNew: boolean) => {
    dishMap[d.id] = {
      ...d,
      cookTotal: cook.total,
      cookLast: cook.last,
      isNew,
      categoryName: catName(d.subcategory) ?? catName(d.category),
    }
  }
  for (const d of all) put(d, d.cook, d.isNew)

  const menus: BrowserMenu[] = MENUS.map((m) => {
    const built = buildMenu(m.id, all, categories)
    const sections: BrowserSection[] = built.sections
      .filter((s) => s.id !== '__seasonal')
      .map((s) => ({
        id: s.id,
        name: s.id === '__top' ? t('menu.top') : s.name,
        navName: s.id === '__top' ? t('menu.topShort') : undefined,
        badge: s.badge ?? (s.dishes.some((d) => d.isNew) ? t('dish.new') : null),
        dishIds: s.dishes.map((d) => d.id),
        groups: s.groups?.map((g) => ({ id: g.id, name: g.name, dishIds: g.dishes.map((d) => d.id) })),
      }))
    return {
      id: m.id,
      label: t(m.labelKey),
      rule: m.include === 'home' ? t('menu.homeRule', { n: HOME_MIN_COOKS }) : t('menu.fullRule'),
      fallbackAll: built.fallbackAll,
      sections,
    }
  })

  // 已下架的菜：只在「完整菜单」末尾出现（管理用）
  if (opts.includeArchived) {
    const stats = getCookStats()
    const empty: CookStat = { total: 0, recent: 0, last: null }
    const archived = db.select().from(dishes).where(eq(dishes.status, 'archived')).all()
    for (const d of archived) put(d, stats.get(d.id) ?? empty, false)
    const full = menus.find((m) => m.id === 'full')
    if (full && archived.length > 0)
      full.sections.push({
        id: '__archived',
        name: t('dishes.archived'),
        badge: null,
        dishIds: archived.map((d) => d.id),
      })
  }

  // 时令海报：管理员指定的带标题 / 海报图；自动的用「本季推荐」+ 菜品照片
  const seasonal = getSeasonal(all)
  const features = new Map(
    db.select().from(menuFeatures).all().map((f) => [f.dishId, f]),
  )
  const posters: BrowserPoster[] = seasonal.dishes.map((d) => {
    const f = seasonal.auto ? undefined : features.get(d.id)
    return { dishId: d.id, title: f?.title || t('menu.seasonal'), posterPath: f?.posterPath ?? null }
  })

  return { menus, dishes: dishMap, posters, postersAuto: seasonal.auto }
}
