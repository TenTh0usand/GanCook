'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ChefHat, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/i18n-provider'
import { deleteCookLog, logCooked } from '@/lib/actions/dishes'

export type CookLogItem = { id: string; date: string; userId: string | null }

/**
 * 菜品「做过次数」区块（GanCook-10k · P2）。
 * 总次数 = 已完成饭局里出现的次数 + 手动「我做过」；手动记录可删（本人 / 管理员）。
 */
export function DishCookSection({
  dishId,
  total,
  last,
  logs,
  meId,
  isAdmin,
  memberNames,
}: {
  dishId: string
  total: number
  last: string | null
  logs: CookLogItem[]
  meId: string
  isAdmin: boolean
  memberNames: Record<string, string>
}) {
  const t = useT()
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState('')
  const fromMeals = Math.max(0, total - logs.length)

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError('')
      const res = await fn()
      if (!res.ok) setError(res.error ?? '')
      else router.refresh()
    })

  return (
    <div className="mf-inset rounded-2xl p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-ink">
            {t('dishform.cooked', { n: total })}
          </p>
          <p className="mt-0.5 text-xs text-secondary">
            {total === 0
              ? t('dishform.cookedNone')
              : t('dishform.cookedDetail', { m: fromMeals, k: logs.length }) +
                (last ? ` · ${t('dishform.cookedLast', { d: last })}` : '')}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="tonal"
          loading={pending}
          onClick={() => run(() => logCooked(dishId))}
        >
          <ChefHat className="h-4 w-4" />
          {t('dishform.iCooked')}
        </Button>
      </div>

      {logs.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-black/[0.05] pt-2.5">
          {logs.slice(0, 5).map((l) => (
            <li key={l.id} className="flex items-center justify-between text-xs text-secondary">
              <span>
                {l.date} · {l.userId ? (memberNames[l.userId] ?? '—') : '—'}
              </span>
              {(l.userId === meId || isAdmin) && (
                <button
                  type="button"
                  className="p-1 text-secondary/70 hover:text-danger"
                  aria-label={t('common.delete')}
                  onClick={() => run(() => deleteCookLog(l.id))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
          {logs.length > 5 && (
            <li className="text-xs text-secondary/70">{t('dishform.moreLogs', { n: logs.length - 5 })}</li>
          )}
        </ul>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  )
}
