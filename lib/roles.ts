/**
 * 角色与餐次的统一定义（GanCook-10k 扩展）。
 * 纯常量，服务端 / 客户端都能引用（不要在这里 import 任何其他模块，schema 也从这里取常量）。
 */

/**
 * 餐次时段：在原 早/午/晚 基础上加 加餐、夜宵。
 * SQLite 里是普通 text 列，无 CHECK 约束，扩展枚举无需迁移。
 */
export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'late'] as const
export type MealType = (typeof MEAL_TYPES)[number]

export const MEAL_EMOJI: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '🍱',
  dinner: '🍲',
  snack: '🧁',
  late: '🌙',
}

/** 贡献统计的四种角色（order 来自点菜表，其余来自 meal_roles） */
export const CONTRIB_KINDS = ['prep', 'cook', 'order', 'clean'] as const
export type ContribKind = (typeof CONTRIB_KINDS)[number]

/** 可在「我的 / 饭局」里打卡的角色 */
export const DUTY_KINDS = ['prep', 'cook', 'clean'] as const
export type DutyKind = (typeof DUTY_KINDS)[number]

/** 统计页默认显示的角色（备菜、善后默认隐藏） */
export const DEFAULT_VISIBLE: ContribKind[] = ['cook', 'order']

/** 备菜 / 善后：统计按「每人每天」去重（原始记录仍逐餐次保存） */
export const DAILY_BINARY_KINDS: ContribKind[] = ['prep', 'clean']

/**
 * 角色元数据：颜色走 globals.css 里的 CSS 变量（自带暗色模式）。
 * - color：实色，用于文字 / 圆点 / 开关
 * - soft：RGB 三元组变量名，用于 rgb(var(--x) / alpha) 的淡色底与热力图深浅
 */
export const ROLE_META: Record<
  ContribKind,
  { labelKey: string; color: string; soft: string; emoji: string }
> = {
  prep: {
    labelKey: 'role.prep',
    color: 'var(--mf-role-prep)',
    soft: '--mf-role-prep-soft',
    emoji: '🥕',
  },
  cook: {
    labelKey: 'role.cook',
    color: 'var(--mf-role-cook)',
    soft: '--mf-role-cook-soft',
    emoji: '🍳',
  },
  order: {
    labelKey: 'role.order',
    color: 'var(--mf-role-order)',
    soft: '--mf-role-order-soft',
    emoji: '🍽️',
  },
  clean: {
    labelKey: 'role.clean',
    color: 'var(--mf-role-clean)',
    soft: '--mf-role-clean-soft',
    emoji: '🫧',
  },
}

/** 淡色底（胶囊 / 图标色块） */
export function roleTint(kind: ContribKind, alpha = 0.16): string {
  return `rgb(var(${ROLE_META[kind].soft}) / ${alpha})`
}

/** 默认时段（按家庭时区的当前时刻）：凌晨 2 点前夜宵 / 10 点前早餐 / 14:30 前午餐 / 17 点前加餐 / 21 点前晚餐 / 之后夜宵 */
export function guessMealType(hour: number, minute: number): MealType {
  const m = hour * 60 + minute
  if (m < 2 * 60) return 'late'
  if (m < 10 * 60) return 'breakfast'
  if (m < 14 * 60 + 30) return 'lunch'
  if (m < 17 * 60) return 'snack'
  if (m < 21 * 60) return 'dinner'
  return 'late'
}

export function isMealType(v: unknown): v is MealType {
  return typeof v === 'string' && (MEAL_TYPES as readonly string[]).includes(v)
}

export function isDutyKind(v: unknown): v is DutyKind {
  return typeof v === 'string' && (DUTY_KINDS as readonly string[]).includes(v)
}

// ── GanCook-10k · P5 外出 / 探店 ──
/** 外出分类：正餐 / 饮品 / 甜点 / 小吃 */
export const OUT_CATEGORIES = ['meal', 'drink', 'dessert', 'snack'] as const
export type OutCategory = (typeof OUT_CATEGORIES)[number]
export const OUT_EMOJI: Record<OutCategory, string> = {
  meal: '🍜',
  drink: '🧋',
  dessert: '🍰',
  snack: '🍢',
}
export function isOutCategory(v: unknown): v is OutCategory {
  return typeof v === 'string' && (OUT_CATEGORIES as readonly string[]).includes(v)
}
