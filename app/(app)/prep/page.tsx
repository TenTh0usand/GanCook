import Image from 'next/image'
import { Plus, Pencil, ShoppingBasket } from 'lucide-react'
import { requireUser } from '@/lib/auth/user'
import { getSettings } from '@/lib/settings'
import { getT } from '@/lib/i18n/server'
import { dayjs, fmtTime, todayLocal } from '@/lib/time'
import { getKindByDates } from '@/lib/duties'
import { getPrepLogsByDate, getPrepSpend, getRecentItemNames } from '@/lib/prep'
import { MEAL_EMOJI, MEAL_TYPES, guessMealType, roleTint } from '@/lib/roles'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { PrepForm } from '@/components/prep/prep-form'
import { DateSwitcher } from '@/components/prep/date-switcher'

export const dynamic = 'force-dynamic'

const yuan = (cents: number) => {
  const v = cents / 100
  return v % 1 === 0 ? String(v) : v.toFixed(1)
}

/**
 * 备菜页（GanCook-10k · P4）：记录某天各餐次买了啥 / 用了冰箱里的啥 / 怎么处理的。
 * 写一条记录会自动给自己打上该餐次的「备菜」。
 */
export default async function PrepPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const me = await requireUser()
  const t = await getT()
  const tz = getSettings().timezone
  const today = todayLocal(tz)
  const yesterday = dayjs(today).subtract(1, 'day').format('YYYY-MM-DD')
  const sp = await searchParams
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today ? sp.date : today

  const logs = getPrepLogsByDate(date)
  const preppers = getKindByDates('prep', [date])[date] ?? {}
  const people = new Map<string, { name: string; avatar: string | null }>()
  for (const s of MEAL_TYPES) for (const p of preppers[s] ?? []) people.set(p.userId, { name: p.name, avatar: p.avatarPath })
  const dayTotal = logs.reduce((a, l) => a + l.totalCents, 0)
  const weekStart = dayjs(date).subtract((dayjs(date).day() + 6) % 7, 'day').format('YYYY-MM-DD')
  const weekTotal = getPrepSpend(weekStart, date)
  const nowLocal = dayjs().tz(tz)
  const defaultSlot = date === today ? guessMealType(nowLocal.hour(), nowLocal.minute()) : 'dinner'
  const suggestions = getRecentItemNames()

  const srcStyle = {
    bought: { label: t('prep.src.bought'), cls: 'text-[var(--mf-role-prep)]', bg: roleTint('prep', 0.16) },
    fridge: { label: t('prep.src.fridge'), cls: 'text-secondary', bg: 'var(--mf-trough)' },
    other: { label: t('prep.src.other'), cls: 'text-secondary', bg: 'var(--mf-trough)' },
  } as const

  const addBtn = (
    <PrepForm date={date} defaultSlot={defaultSlot} suggestions={suggestions}>
      <Button size="sm">
        <Plus className="h-4 w-4" />
        {t('prep.add')}
      </Button>
    </PrepForm>
  )

  return (
    <>
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="tracking-title text-2xl font-bold text-ink">{t('prep.title')}</h1>
          <p className="mt-0.5 text-sm text-secondary">{t('prep.sub')}</p>
        </div>
        {addBtn}
      </header>

      <DateSwitcher date={date} today={today} yesterday={yesterday} />

      {/* 概览：谁在备菜 + 花费 */}
      <div className="mf-raised mb-5 p-4" style={{ background: roleTint('prep', 0.1) }}>
        <div className="relative flex items-center gap-3">
          <span className="mf-chip" style={{ background: roleTint('prep', 0.2), color: 'var(--mf-role-prep)' }}>
            <ShoppingBasket className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">
              {people.size > 0 ? t('prep.whoToday') : t('prep.nobody')}
            </p>
            {people.size > 0 && (
              <div className="mt-1 flex flex-wrap gap-2">
                {[...people].map(([id, p]) => (
                  <span key={id} className="inline-flex items-center gap-1 text-xs text-ink">
                    <Avatar name={p.name} src={p.avatar ? `/api/uploads/${p.avatar}` : null} size={18} />
                    {p.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-bold text-[var(--mf-role-prep)]">¥{yuan(dayTotal)}</p>
            <p className="text-[11px] text-secondary">{t('prep.weekSpend', { n: yuan(weekTotal) })}</p>
          </div>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="mf-inset rounded-2xl p-6 text-center text-sm text-secondary">
          <p>{t('prep.empty')}</p>
          <div className="mt-3 flex justify-center">{addBtn}</div>
        </div>
      ) : (
        <div className="space-y-3">
          {MEAL_TYPES.flatMap((slot) => logs.filter((l) => l.slot === slot)).map((l) => {
            const canEdit = l.userId === me.id || me.isAdmin
            const card = (
              <div className="mf-raised p-4">
                <div className="relative flex items-center gap-2.5">
                  <Avatar
                    name={l.userName ?? '?'}
                    src={l.userAvatar ? `/api/uploads/${l.userAvatar}` : null}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">
                      {l.userName ?? '—'} · {fmtTime(l.createdAt, tz)}
                    </p>
                    <p className="text-xs text-secondary">
                      {MEAL_EMOJI[l.slot]} {t('meal.' + l.slot)}
                    </p>
                  </div>
                  {l.totalCents > 0 && (
                    <span className="text-sm font-bold text-[var(--mf-role-prep)]">¥{yuan(l.totalCents)}</span>
                  )}
                  {canEdit && <Pencil className="h-4 w-4 text-secondary/50" />}
                </div>
                <ul className="relative mt-3 space-y-1.5">
                  {l.items.map((it) => (
                    <li key={it.id} className="flex items-center gap-2 text-sm">
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${srcStyle[it.source].cls}`}
                        style={{ background: srcStyle[it.source].bg }}
                      >
                        {srcStyle[it.source].label}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ink">
                        {it.name}
                        {it.qty && <span className="ml-1.5 text-secondary">{it.qty}</span>}
                      </span>
                      {it.priceCents != null && (
                        <span className="shrink-0 text-xs text-secondary">¥{yuan(it.priceCents)}</span>
                      )}
                    </li>
                  ))}
                </ul>
                {l.note && (
                  <p className="relative mt-2.5 border-t border-black/[0.05] pt-2.5 text-sm text-secondary">
                    {t('prep.noteShow', { s: l.note })}
                  </p>
                )}
                {l.imagePath && (
                  <div className="relative mt-3 aspect-[2.4/1] w-full overflow-hidden rounded-2xl">
                    <Image src={`/api/uploads/${l.imagePath}`} alt="" fill sizes="420px" className="object-cover" />
                  </div>
                )}
              </div>
            )
            return canEdit ? (
              <PrepForm
                key={l.id}
                date={date}
                defaultSlot={defaultSlot}
                suggestions={suggestions}
                log={{
                  id: l.id,
                  date: l.date,
                  slot: l.slot,
                  note: l.note,
                  imagePath: l.imagePath,
                  items: l.items.map((i) => ({ name: i.name, source: i.source, qty: i.qty, priceCents: i.priceCents })),
                }}
              >
                <button type="button" className="mf-pressable block w-full text-left">
                  {card}
                </button>
              </PrepForm>
            ) : (
              <div key={l.id}>{card}</div>
            )
          })}
        </div>
      )}

      <p className="mt-6 px-1 text-center text-xs text-secondary/80">{t('prep.footer')}</p>
    </>
  )
}
