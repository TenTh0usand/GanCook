import Link from 'next/link'
import { ShoppingBasket, ArrowRight } from 'lucide-react'
import { requireUser } from '@/lib/auth/user'
import { getSettings } from '@/lib/settings'
import { getT } from '@/lib/i18n/server'
import { dayjs, todayLocal } from '@/lib/time'
import { getKindByDates } from '@/lib/duties'
import { MEAL_EMOJI, MEAL_TYPES, roleTint } from '@/lib/roles'
import { PageHeader } from '@/components/page-header'
import { Avatar } from '@/components/ui/avatar'

export const dynamic = 'force-dynamic'

/**
 * 备菜页（GanCook-10k）。
 * P1：先展示今天 / 昨天谁备了菜（来自「我的」打卡）。
 * P3：加入备菜记录（买了啥、用了冰箱里的啥、怎么处理、可选价格）。
 */
export default async function PrepPage() {
  await requireUser()
  const t = await getT()
  const tz = getSettings().timezone
  const today = todayLocal(tz)
  const yesterday = dayjs(today).subtract(1, 'day').format('YYYY-MM-DD')
  const data = getKindByDates('prep', [today, yesterday])

  const days = [
    { date: today, label: t('date.today') },
    { date: yesterday, label: t('date.yesterday') },
  ]

  return (
    <>
      <PageHeader title={t('prep.title')} subtitle={t('prep.sub')} />

      <div className="mf-raised mb-6 p-5" style={{ background: roleTint('prep', 0.1) }}>
        <div className="relative flex items-start gap-3">
          <span
            className="mf-chip"
            style={{ background: roleTint('prep', 0.2), color: 'var(--mf-role-prep)' }}
          >
            <ShoppingBasket className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="font-semibold text-ink">{t('prep.comingTitle')}</p>
            <p className="mt-1 text-sm leading-relaxed text-secondary">{t('prep.comingDesc')}</p>
            <Link
              href="/me"
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium"
              style={{ color: 'var(--mf-role-prep)' }}
            >
              {t('prep.goCheckin')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {days.map(({ date, label }) => {
        const slots = MEAL_TYPES.filter((s) => (data[date][s] ?? []).length > 0)
        return (
          <section key={date} className="mb-5">
            <h2 className="mf-section mb-2 text-[15px] text-ink">{label}</h2>
            {slots.length === 0 ? (
              <div className="mf-inset rounded-2xl p-4 text-center text-sm text-secondary">
                {t('prep.noneDay')}
              </div>
            ) : (
              <div className="mf-list">
                {slots.map((s) => (
                  <div key={s} className="mf-row mf-row-inset">
                    <span className="mf-chip text-[17px]" style={{ background: roleTint('prep') }}>
                      {MEAL_EMOJI[s]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium text-ink">{t('meal.' + s)}</span>
                      <span className="mt-1 flex flex-wrap gap-2">
                        {data[date][s]!.map((p) => (
                          <span key={p.userId} className="inline-flex items-center gap-1 text-xs text-ink">
                            <Avatar
                              name={p.name}
                              src={p.avatarPath ? `/api/uploads/${p.avatarPath}` : null}
                              size={18}
                            />
                            {p.name}
                          </span>
                        ))}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </>
  )
}
