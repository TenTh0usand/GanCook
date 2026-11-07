/**
 * 菜单定义（GanCook-10k · P2）—— 纯常量，服务端 / 客户端都能用。
 *
 * 「多菜单」= 同一批菜的不同视图：菜单本身不存菜，只定义「收录规则 + 分组方式」。
 * 以后加新菜单：在 MENUS 里加一项即可。
 */

export type MenuId = 'home' | 'full'

export type MenuDef = {
  id: MenuId
  labelKey: string
  /** 收录规则：home = 家常精选 + 最近 3 个月做过 ≥ 2 次；all = 全部菜 */
  include: 'home' | 'all'
  /** 是否在大类里按细类分小标题 */
  subgroups: boolean
}

/** 顺序即页面上的顺序：简版在前，复杂版在后 */
export const MENUS: MenuDef[] = [
  { id: 'home', labelKey: 'menu.home', include: 'home', subgroups: false },
  { id: 'full', labelKey: 'menu.full', include: 'all', subgroups: true },
]

/** 家常菜单自动收录：最近 N 天内做过至少 M 次 */
export const HOME_RECENT_DAYS = 90
export const HOME_MIN_COOKS = 2
/** 时令海报：没有管理员指定时，取最近 N 天做得最多的前 K 道 */
export const SEASONAL_DAYS = 90
export const SEASONAL_LIMIT = 5
/** 「常做 TOP」分组显示几道 */
export const TOP_LIMIT = 6
/** 新菜角标：添加后多少天内 */
export const NEW_DAYS = 14

export function isMenuId(v: unknown): v is MenuId {
  return MENUS.some((m) => m.id === v)
}
