'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Check, Plus } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { useT } from '@/components/i18n-provider'
import { toggleMyRole } from '@/lib/actions/duties'
import { DUTY_KINDS, ROLE_META, roleTint, type DutyKind, type MealType } from '@/lib/roles'

type Person = { userId: string; name: string; avatarPath: string | null }

/**
 * 饭局详情 → 这顿的分工（GanCook-10k）。
 * 展示该餐次的 备菜 / 做菜 / 善后 都有谁；备菜、善后可以在这里给自己打卡
 * （做菜用上方的大按钮「我来做这顿 / 我也来做」）。只能标记自己。
 */
export function MealRolesCard({
  date,
  slot,
  roles,
  meId,
}: {
  date: string
  slot: MealType
  roles: Record<DutyKind, Person[]>
  meId: string
}) {
  const t = useT()
  const router = useRouter()
  const [pending, setPending] = React.useState<DutyKind | null>(null)
  const [error, setError] = React.useState('')

  const flip = async (kind: DutyKind) => {
    setError('')
    setPending(kind)
    const res = await toggleMyRole({ date, slot, kind })
    setPending(null)
    if (!res.ok) setError(res.error)
    else router.refresh()
  }

  return (
    <section className="mb-6">
      <h2 className="mb-3 text-base font-semibold text-ink">{t('detail.roles')}</h2>
      <div className="mf-list">
        {DUTY_KINDS.map((k) => {
          const meta = ROLE_META[k]
          const people = roles[k]
          const mine = people.some((p) => p.userId === meId)
          return (
            <div key={k} className="mf-row mf-row-inset">
              <span className="mf-chip" style={{ background: roleTint(k) }}>
                <span className="text-[17px] leading-none">{meta.emoji}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-ink">{t(meta.labelKey)}</span>
                {people.length === 0 ? (
                  <span className="mt-0.5 block text-xs text-secondary">{t('detail.rolesEmpty')}</span>
                ) : (
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    {people.map((p) => (
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
                )}
              </span>
              {k !== 'cook' && (
                <button
                  type="button"
                  disabled={pending === k}
                  onClick={() => flip(k)}
                  className="mf-pressable inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold disabled:opacity-60"
                  style={
                    mine
                      ? { background: roleTint(k), color: meta.color }
                      : {
                          border: '1px dashed rgba(var(--mf-shadow) / 0.35)',
                          color: 'var(--mf-secondary)',
                        }
                  }
                >
                  {mine ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  {t('detail.rolesMe')}
                </button>
              )}
            </div>
          )
        })}
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </section>
  )
}
