'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Row } from '@/components/ui/list'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { useT } from '@/components/i18n-provider'
import { toggleMyRole } from '@/lib/actions/duties'
import {
  CONTRIB_KINDS,
  DUTY_KINDS,
  MEAL_TYPES,
  ROLE_META,
  roleTint,
  type ContribKind,
  type DutyKind,
  type MealType,
} from '@/lib/roles'

/** 某天：各时段我参与了哪些角色（含点菜，用于展示小圆点） */
export type DayRoles = Partial<Record<MealType, ContribKind[]>>

/**
 * 「我的」→ 今天的家务（GanCook-10k）。
 * 选日期（今天 / 昨天）+ 选时段，三个开关只改自己的记录；点了立即生效（乐观更新）。
 */
export function TodayDuties({
  today,
  yesterday,
  defaultSlot,
  initial,
}: {
  today: string
  yesterday: string
  defaultSlot: MealType
  initial: Record<string, DayRoles>
}) {
  const t = useT()
  const router = useRouter()
  const [day, setDay] = React.useState<'today' | 'yesterday'>('today')
  const [slot, setSlot] = React.useState<MealType>(defaultSlot)
  const [data, setData] = React.useState(initial)
  const [prevInitial, setPrevInitial] = React.useState(initial)
  const [error, setError] = React.useState('')
  const [, startTransition] = React.useTransition()

  if (prevInitial !== initial) {
    setPrevInitial(initial)
    setData(initial)
  }

  const date = day === 'today' ? today : yesterday
  const dayRoles = data[date] ?? {}
  const current = dayRoles[slot] ?? []

  const flip = (kind: DutyKind) => {
    setError('')
    const apply = (on: boolean) =>
      setData((prev) => {
        const d = { ...(prev[date] ?? {}) }
        const list = new Set(d[slot] ?? [])
        if (on) list.add(kind)
        else list.delete(kind)
        d[slot] = [...list]
        return { ...prev, [date]: d }
      })
    const turnOn = !current.includes(kind)
    apply(turnOn) // 乐观更新：先变，失败再改回
    startTransition(async () => {
      const res = await toggleMyRole({ date, slot, kind })
      if (!res.ok) {
        apply(!turnOn)
        setError(res.error)
      } else {
        router.refresh()
      }
    })
  }

  const activeSlots = MEAL_TYPES.filter((s) => (dayRoles[s] ?? []).length > 0)

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="mf-section text-[15px] text-ink">{t('duties.title')}</h2>
        <Segmented<'today' | 'yesterday'>
          value={day}
          onChange={setDay}
          layoutId="duties-day"
          className="w-[148px] [&_button]:py-1 [&_button]:text-xs"
          options={[
            { value: 'today', label: t('date.today') },
            { value: 'yesterday', label: t('date.yesterday') },
          ]}
        />
      </div>

      <div className="mf-list">
        <div className="p-3 pb-1">
          <Segmented<MealType>
            value={slot}
            onChange={setSlot}
            layoutId="duties-slot"
            className="[&_button]:px-1"
            options={MEAL_TYPES.map((s) => ({ value: s, label: t('meal.' + s) }))}
          />
        </div>

        {DUTY_KINDS.map((k) => {
          const meta = ROLE_META[k]
          const on = current.includes(k)
          return (
            <Row
              key={k}
              leading={
                <span className="mf-chip" style={{ background: roleTint(k) }}>
                  <span className="text-[17px] leading-none">{meta.emoji}</span>
                </span>
              }
              title={t(`duties.${k}`)}
              subtitle={t(`duties.${k}Desc`)}
              trailing={
                <Switch
                  checked={on}
                  onChange={() => flip(k)}
                  color={meta.color}
                  label={t(`duties.${k}`)}
                />
              }
              chevron={false}
            />
          )
        })}

        <div className="mf-row flex-col !items-stretch !gap-2">
          <p className="text-xs font-semibold text-secondary">
            {day === 'today' ? t('duties.myToday') : t('duties.myYesterday')}
          </p>
          {activeSlots.length === 0 ? (
            <p className="text-xs text-secondary/80">{t('duties.none')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeSlots.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-2 rounded-[var(--radius-chip)] bg-trough px-3 py-1.5 text-xs font-medium text-ink"
                >
                  {t('meal.' + s)}
                  <span className="flex gap-1">
                    {CONTRIB_KINDS.map((k) => (
                      <span
                        key={k}
                        title={t(ROLE_META[k].labelKey)}
                        className="h-2 w-2 rounded-full"
                        style={{
                          background: (dayRoles[s] ?? []).includes(k)
                            ? ROLE_META[k].color
                            : 'rgba(var(--mf-shadow) / 0.15)',
                        }}
                      />
                    ))}
                  </span>
                </span>
              ))}
            </div>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      </div>
    </section>
  )
}
