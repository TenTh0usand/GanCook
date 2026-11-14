import Link from 'next/link'
import { Clock, Users, ChefHat, ChevronRight, Star, Store } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { TIMEZONE } from '@/lib/env'
import { MEAL_EMOJI, fmtTime, fmtDateLabel } from '@/lib/time'
import { getT } from '@/lib/i18n/server'
import { cn } from '@/lib/utils'
import type { Meal } from '@/lib/db/schema'
import { OUT_EMOJI, type OutCategory } from '@/lib/roles'
import { fmtYuan } from '@/lib/outing'

export const STATUS_META: Record<
  Meal['status'],
  { labelKey: string; tone: 'accent' | 'warn' | 'neutral' | 'danger'; tile: string }
> = {
  ordering: { labelKey: 'status.ordering', tone: 'accent', tile: 'bg-tint' },
  cooking: {
    labelKey: 'status.cooking',
    tone: 'warn',
    tile: '[background:rgba(224,161,58,0.18)]',
  },
  done: { labelKey: 'status.done', tone: 'neutral', tile: 'bg-trough' },
  cancelled: {
    labelKey: 'status.cancelled',
    tone: 'danger',
    tile: 'bg-[rgb(217,83,79,0.12)]',
  },
}

export async function MealCard({
  meal,
  cookName,
  participants,
  tz = TIMEZONE,
  score,
  dishes,
  outing,
}: {
  meal: Meal
  cookName?: string | null
  participants?: number
  tz?: string
  /** GanCook-10k（P3）：全家平均分（×10） */
  score?: number | null
  /** 这顿点了哪些菜（历史 / 搜索结果里显示一行） */
  dishes?: string[]
  /** GanCook-10k（P5）：外出信息 */
  outing?: { venueName: string | null; category: OutCategory | null; perCents: number | null } | null
}) {
  const t = await getT()
  const status = STATUS_META[meal.status]
  const fallbackTitle = t('meal.' + meal.mealType)
  const isOut = meal.kind === 'out'
  return (
    <Link
      href={`/meals/${meal.id}`}
      className="group mf-raised mf-pressable flex items-center gap-3.5 p-3.5"
    >
      <div
        className={cn(
          'flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[var(--radius-field)] text-[26px]',
          isOut ? 'bg-[rgb(var(--mf-role-out-soft)/0.16)]' : status.tile,
        )}
      >
        {isOut ? (outing?.category ? OUT_EMOJI[outing.category] : '🏪') : MEAL_EMOJI[meal.mealType]}
      </div>

      <div className="relative min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold tracking-title text-ink">
            {(isOut && outing?.venueName) || meal.title || fallbackTitle}
          </span>
          {meal.isAuto && <Badge tone="auto">{t('mealcard.auto')}</Badge>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-secondary">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {fmtDateLabel(meal.date, tz, t)} {fmtTime(meal.diningTime, tz)}
          </span>
          {isOut && (
            <span className="inline-flex items-center gap-1 font-medium text-[var(--mf-role-out)]">
              <Store className="h-3.5 w-3.5" />
              {t('outing.label')}
              {outing?.perCents != null && ` · ${t('outing.perShort', { n: fmtYuan(outing.perCents) })}`}
            </span>
          )}
          {!isOut && typeof participants === 'number' && participants > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {t('mealcard.people', { n: participants })}
            </span>
          )}
          {!isOut && cookName && (
            <span className="inline-flex items-center gap-1 text-accent">
              <ChefHat className="h-3.5 w-3.5" />
              {cookName}
            </span>
          )}
        </div>
        {!isOut && dishes && dishes.length > 0 && (
          <p className="mt-1 truncate text-xs text-ink/80">{dishes.join(t('common.listSep'))}</p>
        )}
      </div>

      <div className="relative flex shrink-0 flex-col items-end gap-1">
        {score != null && (
          <span className="inline-flex items-center gap-0.5 pr-5 text-[13px] font-bold text-[#b3791f]">
            <Star className="h-3.5 w-3.5 fill-[#f0b429] text-[#f0b429]" />
            {(score / 10).toFixed(1)}
          </span>
        )}
        <div className="flex items-center gap-1">
          <Badge tone={status.tone}>
            {meal.status === 'ordering' && (
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            )}
            {t(status.labelKey)}
          </Badge>
          <ChevronRight className="h-4 w-4 text-secondary/40 transition-transform duration-150 group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  )
}
