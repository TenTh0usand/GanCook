import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import 'dayjs/locale/zh-cn'
import { TIMEZONE } from '@/lib/env'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(customParseFormat)
dayjs.locale('zh-cn')

export { dayjs }

// 餐次 emoji 统一定义在 lib/roles.ts（客户端组件也要用）
export { MEAL_EMOJI } from '@/lib/roles'

/** 跨午夜分界点：凌晨 02:00 之前仍归入前一天（方便跨午夜夜宵） */
export const DAY_ROLLOVER_HOUR = 2

/** 当前 unix 秒 */
export function nowSec(): number {
  return Math.floor(Date.now() / 1000)
}

/**
 * 把家庭时区下的「某天 + HH:MM」转成 unix 秒。
 * 凌晨 00:00–01:59 视为该营业日的次日凌晨（例如 11 月 11 日的夜宵 00:30 → 11 月 12 日 00:30），
 * 这样截止时间 23:30 自然早于用餐时间 00:30。
 */
export function localDateTimeToSec(
  date: string,
  hhmm: string,
  tz: string = TIMEZONE,
): number {
  const hour = Number(hhmm.slice(0, 2))
  const base = dayjs.tz(`${date} ${hhmm}`, 'YYYY-MM-DD HH:mm', tz)
  return (hour < DAY_ROLLOVER_HOUR ? base.add(1, 'day') : base).unix()
}

/** 家庭时区下的今天 YYYY-MM-DD（凌晨 02:00 前仍算前一天） */
export function todayLocal(tz: string = TIMEZONE): string {
  return dayjs().tz(tz).subtract(DAY_ROLLOVER_HOUR, 'hour').format('YYYY-MM-DD')
}

/** 格式化用餐时间用于展示 */
export function fmtTime(sec: number, tz: string = TIMEZONE): string {
  return dayjs.unix(sec).tz(tz).format('HH:mm')
}

type TFn = (key: string, vars?: Record<string, string | number>) => string

/** 友好日期标签（今天/明天/昨天/M月D日），需传入翻译函数 t */
export function fmtDateLabel(date: string, tz: string, t: TFn): string {
  const d = dayjs.tz(date, 'YYYY-MM-DD', tz)
  const today = dayjs.tz(todayLocal(tz), 'YYYY-MM-DD', tz)
  const diff = d.startOf('day').diff(today.startOf('day'), 'day')
  if (diff === 0) return t('date.today')
  if (diff === 1) return t('date.tomorrow')
  if (diff === -1) return t('date.yesterday')
  return t('date.md', { m: d.month() + 1, d: d.date() })
}

/** 相对截止时间的友好文案，需传入翻译函数 t */
export function deadlineText(
  deadlineSec: number,
  tz: string,
  t: TFn,
): string {
  const now = nowSec()
  if (now >= deadlineSec) return t('deadline.ended')
  const mins = Math.round((deadlineSec - now) / 60)
  if (mins < 60) return t('deadline.minutes', { n: mins })
  const hours = Math.round(mins / 60)
  if (hours < 24) return t('deadline.hours', { n: hours })
  const d = dayjs.unix(deadlineSec).tz(tz)
  return t('deadline.at', {
    date: t('date.md', { m: d.month() + 1, d: d.date() }),
    time: fmtTime(deadlineSec, tz),
  })
}
