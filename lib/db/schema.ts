/**
 * 干饭厨子 数据库结构（Drizzle ORM / SQLite）
 *
 * 设计要点（相对原 mycook 的改造）：
 * - 去掉 users.role：一账号多角色，做饭人按「每一餐」在 meals.cookId 上认领
 * - 菜品图片只存文件路径（imagePath），不再用 base64
 * - 新增 mealSchedules（自动饭局规则）与 settings（家庭配置）
 * - 单实例单家庭：无需 household 表
 */
import { sql } from 'drizzle-orm'
import {
  sqliteTable,
  text,
  integer,
  unique,
  index,
} from 'drizzle-orm/sqlite-core'
import { MEAL_TYPES, OUT_CATEGORIES } from '../roles'
import type { ScoreDim } from '../scoring'

const now = sql`(unixepoch())`

// 餐次时段（含 GanCook-10k 扩展的 加餐 / 夜宵），定义在 lib/roles.ts 以便客户端共用
export { MEAL_TYPES, type MealType } from '../roles'

/** 时间统一用 unix 秒（integer），便于排序与 dayjs 转换 */

// ── 用户（家庭成员） ──
export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  avatarPath: text('avatar_path'),
  // 首位注册者 = 管理员
  isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull().default(now),
})

// ── 菜品库 ──
export const dishes = sqliteTable(
  'dishes',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    description: text('description'),
    // 图片相对路径，如 dishes/<uuid>.webp（落盘存储，非 base64）
    imagePath: text('image_path'),
    // 标签：荤/素/汤/主食 等，JSON 数组存储
    tags: text('tags', { mode: 'json' }).$type<string[]>().default([]),
    status: text('status', { enum: ['active', 'archived'] })
      .notNull()
      .default('active'),
    // GanCook-10k（P2 菜单）：大类 / 细类（指向 dish_categories.id，可空 = 其他）、家常精选
    category: text('category'),
    subcategory: text('subcategory'),
    pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => [index('idx_dishes_status').on(t.status)],
)

// ── 饭局（一餐） ──
export const meals = sqliteTable(
  'meals',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text('title'),
    mealType: text('meal_type', {
      enum: MEAL_TYPES,
    }).notNull(),
    // 日期 YYYY-MM-DD（家庭时区下的自然日，用于唯一约束与展示）
    date: text('date').notNull(),
    diningTime: integer('dining_time').notNull(),
    orderDeadline: integer('order_deadline').notNull(),
    // 做饭人：按每一餐认领，可空
    cookId: text('cook_id').references(() => users.id, { onDelete: 'set null' }),
    status: text('status', {
      enum: ['ordering', 'cooking', 'done', 'cancelled'],
    })
      .notNull()
      .default('ordering'),
    // 是否由调度器自动创建
    isAuto: integer('is_auto', { mode: 'boolean' }).notNull().default(false),
    // 来源规则（自动创建时记录，用于幂等；规则删除后置空）
    scheduleId: text('schedule_id').references(() => mealSchedules.id, {
      onDelete: 'set null',
    }),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: integer('created_at').notNull().default(now),
    // GanCook-10k（P5）：在家 / 外出。外出时下面几项都可空（金额单位：分）
    kind: text('kind', { enum: ['home', 'out'] }).notNull().default('home'),
    outCategory: text('out_category', { enum: OUT_CATEGORIES }),
    venueId: text('venue_id').references(() => venues.id, { onDelete: 'set null' }),
    totalCents: integer('total_cents'),
    headcount: integer('headcount'),
    paidCents: integer('paid_cents'),
  },
  (t) => [
    index('idx_meals_status').on(t.status),
    index('idx_meals_kind').on(t.kind),
    index('idx_meals_date').on(t.date),
    index('idx_meals_schedule').on(t.scheduleId),
  ],
)

// ── 点菜记录（谁点了什么） ──
export const orders = sqliteTable(
  'orders',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    mealId: text('meal_id')
      .notNull()
      .references(() => meals.id, { onDelete: 'cascade' }),
    dishId: text('dish_id')
      .notNull()
      .references(() => dishes.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    note: text('note'),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => [
    unique('uniq_order').on(t.mealId, t.dishId, t.userId),
    index('idx_orders_meal').on(t.mealId),
    index('idx_orders_user').on(t.userId),
  ],
)

// ── 餐后评价（轻量） ──
export const reviews = sqliteTable(
  'reviews',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    mealId: text('meal_id')
      .notNull()
      .references(() => meals.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    comment: text('comment'),
    // GanCook-10k（P3 评分）：分数 ×10 存整数（4.5 → 45），rating 保留并自动同步为四舍五入的整数
    scoreX10: integer('score_x10'),
    mode: text('mode', { enum: ['simple', 'sci'] }).notNull().default('simple'),
    // 科学评分六个维度（各自 ×10），简易评分为空
    dims: text('dims', { mode: 'json' }).$type<Partial<Record<ScoreDim, number>>>(),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => [
    unique('uniq_review').on(t.mealId, t.userId),
    index('idx_reviews_meal').on(t.mealId),
  ],
)

// ── 自动饭局规则（管理员配置） ──
export const mealSchedules = sqliteTable('meal_schedules', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  // 规则名称（像闹钟标签，如「工作日午餐」「周末早午餐」）
  name: text('name').notNull().default('饭局'),
  mealType: text('meal_type', {
    enum: MEAL_TYPES,
  }).notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  // 用餐时间 HH:MM（家庭时区）
  diningTime: text('dining_time').notNull(),
  // 提前多少小时创建点菜（如 16 = 前一天 20:00 开次日 12:00 的午餐）
  createLeadHours: integer('create_lead_hours').notNull().default(16),
  // 点菜截止早于用餐多少分钟
  deadlineLeadMinutes: integer('deadline_lead_minutes').notNull().default(120),
  // 生效星期：0(周日)..6，JSON 数组
  weekdays: text('weekdays', { mode: 'json' })
    .$type<number[]>()
    .notNull()
    .default([0, 1, 2, 3, 4, 5, 6]),
  createdAt: integer('created_at').notNull().default(now),
})

// ── 家庭设置（键值表，单家庭） ──
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
})

// ── 餐次分工（GanCook-10k 扩展）：谁在某个餐次参与了 备菜 / 做菜 / 善后 ──
// 记在「日期 + 时段」上，不依赖饭局：没开饭局也能记；有在家饭局时 mealId 自动关联。
// 原始记录逐餐次保存；统计时 备菜 / 善后 按「每人每天」去重。
export const mealRoles = sqliteTable(
  'meal_roles',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    slot: text('slot', { enum: MEAL_TYPES }).notNull(),
    kind: text('kind', { enum: ['prep', 'cook', 'clean'] }).notNull(),
    mealId: text('meal_id').references(() => meals.id, { onDelete: 'set null' }),
    // manual = 自己打卡；meal = 饭局里点「我也来做」；prep_log = 写备菜记录时自动
    source: text('source', { enum: ['manual', 'meal', 'prep_log'] })
      .notNull()
      .default('manual'),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => [
    unique('uniq_meal_role').on(t.userId, t.date, t.slot, t.kind),
    index('idx_meal_roles_date').on(t.date, t.slot),
    index('idx_meal_roles_meal').on(t.mealId),
  ],
)

// ── 菜品分类（GanCook-10k · P2）：parentId 为空 = 大类，否则为该大类下的细类 ──
// 预置默认分类见迁移文件；管理员以后可改名、排序、加角标
export const dishCategories = sqliteTable('dish_categories', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  parentId: text('parent_id'),
  // 左侧导航上方的小角标，如「新」「秋冬上新」
  badge: text('badge'),
  sort: integer('sort').notNull().default(0),
  createdAt: integer('created_at').notNull().default(now),
})

// ── 手动「我做过」记录（没开饭局时补记做过次数） ──
export const dishCookLogs = sqliteTable(
  'dish_cook_logs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    dishId: text('dish_id')
      .notNull()
      .references(() => dishes.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    date: text('date').notNull(),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => [index('idx_cook_logs_dish').on(t.dishId)],
)

// ── 本季推荐 / 时令海报（管理员指定；没指定时自动取最近 3 个月做得最多的菜） ──
export const menuFeatures = sqliteTable('menu_features', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  dishId: text('dish_id')
    .notNull()
    .references(() => dishes.id, { onDelete: 'cascade' }),
  title: text('title'),
  posterPath: text('poster_path'),
  // YYYY-MM-DD，可空 = 不限
  startDate: text('start_date'),
  endDate: text('end_date'),
  sort: integer('sort').notNull().default(0),
  createdAt: integer('created_at').notNull().default(now),
})

// 类型导出
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Dish = typeof dishes.$inferSelect
export type NewDish = typeof dishes.$inferInsert
export type Meal = typeof meals.$inferSelect
export type NewMeal = typeof meals.$inferInsert
export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
export type Review = typeof reviews.$inferSelect
export type NewReview = typeof reviews.$inferInsert
export type MealSchedule = typeof mealSchedules.$inferSelect
export type NewMealSchedule = typeof mealSchedules.$inferInsert
export type MealRole = typeof mealRoles.$inferSelect
export type RoleKind = MealRole['kind']
export type DishCategory = typeof dishCategories.$inferSelect
export type DishCookLog = typeof dishCookLogs.$inferSelect
export type MenuFeature = typeof menuFeatures.$inferSelect
export type PrepLog = typeof prepLogs.$inferSelect
export type PrepItem = typeof prepItems.$inferSelect

// ── 备菜记录（GanCook-10k · P4）：某人某餐次买了啥 / 用了冰箱里的啥 / 怎么处理的 ──
// 只有「食材名称」必填；数量是自由文字（如「1.2斤」「3个」），价格可不填
export const prepLogs = sqliteTable(
  'prep_logs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    date: text('date').notNull(),
    slot: text('slot', { enum: MEAL_TYPES }).notNull(),
    mealId: text('meal_id').references(() => meals.id, { onDelete: 'set null' }),
    // 处理方式（自由文字）
    note: text('note'),
    imagePath: text('image_path'),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => [index('idx_prep_logs_date').on(t.date)],
)

export const prepItems = sqliteTable(
  'prep_items',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    logId: text('log_id')
      .notNull()
      .references(() => prepLogs.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // bought = 买的；fridge = 冰箱里的；other = 别人给的 / 自己种的等
    source: text('source', { enum: ['bought', 'fridge', 'other'] })
      .notNull()
      .default('bought'),
    qty: text('qty'),
    // 价格（分）；可空。以后 P6 菜价库会从这里联动
    priceCents: integer('price_cents'),
    sort: integer('sort').notNull().default(0),
  },
  (t) => [index('idx_prep_items_log').on(t.logId)],
)

// ── GanCook-10k（P5）：外出 / 探店 ──
/** 店铺（只存名字和区域，用于联想和「常去的店」统计） */
export const venues = sqliteTable('venues', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  area: text('area'),
  createdAt: integer('created_at').notNull().default(now),
})

/** 外出同行的家人 */
export const mealCompanions = sqliteTable(
  'meal_companions',
  {
    mealId: text('meal_id')
      .notNull()
      .references(() => meals.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [unique('uniq_meal_companion').on(t.mealId, t.userId), index('idx_meal_companions_meal').on(t.mealId)],
)

export type Venue = typeof venues.$inferSelect
