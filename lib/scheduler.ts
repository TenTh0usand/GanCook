import 'server-only'
import { and, eq, lte, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { meals, mealSchedules } from '@/lib/db/schema'
import { getSettings } from '@/lib/settings'
import { dayjs, localDateTimeToSec, nowSec, todayLocal } from '@/lib/time'
import { linkSlotToMeal } from '@/lib/duties'

// 用餐时间过后多久自动标记「已完成」
const DONE_AFTER_SEC = 4 * 3600

/** 空的自动饭局（没人点菜 / 评分 / 认领 / 打卡家务 / 记备菜）用餐后多久自动删除 */
export const PURGE_EMPTY_AUTO_AFTER_SEC = 3 * 86400

export type TickResult = {
  created: number
  started: number
  finished: number
  purged: number
}

/**
 * 调度心跳：幂等创建到点的自动饭局 + 自动流转状态。
 * 可被进程内 cron 调用，也可被 /api/cron/tick 手动触发。
 */
export function tick(): TickResult {
  const tz = getSettings().timezone
  const now = nowSec()

  return db.transaction(() => {
    let created = 0

    // 1) 按规则创建到点的饭局
    const schedules = db
      .select()
      .from(mealSchedules)
      .where(eq(mealSchedules.enabled, true))
      .all()

    const baseDay = dayjs.tz(todayLocal(tz), 'YYYY-MM-DD', tz)

    for (const s of schedules) {
      // 检查未来 3 天内的候选日期（覆盖较大的提前量；凌晨 2 点前仍以昨晚所属营业日为起点）
      for (let offset = 0; offset <= 2; offset++) {
        const day = baseDay.add(offset, 'day')
        const date = day.format('YYYY-MM-DD')
        if (!s.weekdays.includes(day.day())) continue

        const diningSec = localDateTimeToSec(date, s.diningTime, tz)
        const createSec = diningSec - s.createLeadHours * 3600
        // 到了创建时刻、且用餐时间还没过
        if (now < createSec || now >= diningSec) continue

        const deadlineSec = diningSec - s.deadlineLeadMinutes * 60

        // 幂等：同一规则同一天只建一次
        const exists = db
          .select({ id: meals.id })
          .from(meals)
          .where(and(eq(meals.scheduleId, s.id), eq(meals.date, date)))
          .get()
        if (exists) continue

        const row = db
          .insert(meals)
          .values({
            title: s.name,
            mealType: s.mealType,
            date,
            diningTime: diningSec,
            orderDeadline: deadlineSec,
            status: 'ordering',
            isAuto: true,
            scheduleId: s.id,
          })
          .returning({ id: meals.id })
          .get()
        linkSlotToMeal(date, s.mealType, row.id)
        created++
      }
    }

    // 2) 点菜截止 → 做饭中
    const started = db
      .update(meals)
      .set({ status: 'cooking' })
      .where(
        and(eq(meals.status, 'ordering'), lte(meals.orderDeadline, now)),
      )
      .run().changes

    // 3) 用餐结束 → 已完成（含错过截止仍在 ordering 的）
    const finished = db
      .update(meals)
      .set({ status: 'done' })
      .where(
        and(
          inArray(meals.status, ['ordering', 'cooking']),
          lte(meals.diningTime, now - DONE_AFTER_SEC),
        ),
      )
      .run().changes

    // 4) 清理空的自动饭局：自动生成、已结束、用餐已过 3 天，且这一餐没有任何记录
    //    （点菜、评分、掌勺、同餐次的备菜 / 做菜 / 善后打卡、备菜记录都没有）——多半是没人记或凑合一顿
    const purged = db.run(sql`
      DELETE FROM meals
      WHERE is_auto = 1
        AND status IN ('done', 'cancelled')
        AND cook_id IS NULL
        AND dining_time <= ${now - PURGE_EMPTY_AUTO_AFTER_SEC}
        AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.meal_id = meals.id)
        AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.meal_id = meals.id)
        AND NOT EXISTS (SELECT 1 FROM meal_roles mr
                        WHERE mr.meal_id = meals.id OR (mr.date = meals.date AND mr.slot = meals.meal_type))
        AND NOT EXISTS (SELECT 1 FROM prep_logs p
                        WHERE p.meal_id = meals.id OR (p.date = meals.date AND p.slot = meals.meal_type))
    `).changes

    return { created, started, finished, purged }
  })
}

// 进程内 cron 只启动一次
const g = globalThis as unknown as { __gancookCron?: boolean }

export async function startScheduler() {
  if (g.__gancookCron) return
  g.__gancookCron = true
  const cron = (await import('node-cron')).default
  // 每 5 分钟一次
  cron.schedule('*/5 * * * *', () => {
    try {
      const r = tick()
      if (r.created || r.started || r.finished || r.purged)
        console.log('[scheduler]', r)
    } catch (e) {
      console.error('[scheduler] tick failed', e)
    }
  })
  // 启动时先跑一次，补齐停机期间错过的饭局
  try {
    tick()
  } catch (e) {
    console.error('[scheduler] initial tick failed', e)
  }
  console.log('[scheduler] 已启动（每 5 分钟检查一次）')
}
