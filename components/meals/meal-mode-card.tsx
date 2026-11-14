'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Store, UtensilsCrossed } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/i18n-provider'
import { setMealKind } from '@/lib/actions/outing'
import { moneyBurst } from '@/components/meals/money-burst'
import { OutingForm, type OutingFormValue } from '@/components/meals/outing-form'
import { cn } from '@/lib/utils'

/**
 * 饭局详情页的「点菜 / 出去吃」卡片（GanCook-10k · P5）
 * 点左边图标切换在家 / 外出：先弹窗确认 → 图标翻转 + 底色渐变 + 撒钱 / 省钱特效 → 保存。
 */
export function MealModeCard({
  mealId,
  kind: initialKind,
  orderingOpen,
  myOrderNames,
  totalOrders,
  outSummary,
  outing,
  venues,
  members,
  meId,
}: {
  mealId: string
  kind: 'home' | 'out'
  orderingOpen: boolean
  myOrderNames: string[]
  totalOrders: number
  /** 外出时卡片副标题（如「楼下面馆 · 人均 ¥45」），没填写为 null */
  outSummary: string | null
  outing: OutingFormValue
  venues: string[]
  members: { id: string; name: string; avatarPath: string | null }[]
  meId: string
}) {
  const t = useT()
  const router = useRouter()
  const iconRef = useRef<HTMLButtonElement>(null)
  const [kind, setKind] = useState(initialKind)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const isOut = kind === 'out'
  const next = isOut ? 'home' : 'out'

  const doSwitch = () => {
    setConfirmOpen(false)
    const r = iconRef.current?.getBoundingClientRect()
    const origin = r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: 60, y: 300 }
    const prev = kind
    setKind(next)
    // 等确认弹窗收起（约 200ms）再放特效，避免被遮罩盖住
    setTimeout(() => moneyBurst(origin, next === 'out' ? 'spend' : 'save', t('mode.saved')), 180)
    startTransition(async () => {
      const res = await setMealKind(mealId, next)
      if (!res.ok) setKind(prev)
      router.refresh()
    })
  }

  return (
    <section className="mb-6">
      <div className="mf-tonal relative flex items-center gap-3 overflow-hidden p-4">
        {/* 外出时的莓果粉底色层（opacity 渐变，零重排） */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[rgb(var(--mf-role-out-soft)/0.16)] transition-opacity duration-500"
          style={{ opacity: isOut ? 1 : 0 }}
        />

        <button
          ref={iconRef}
          type="button"
          aria-label={isOut ? t('mode.toHome') : t('mode.toOut')}
          disabled={pending}
          onClick={() => setConfirmOpen(true)}
          className={cn(
            'mf-pressable relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[calc(var(--radius-field)*0.7)] bg-surface shadow-[var(--mf-elev-1)] transition-colors duration-500',
            isOut ? 'text-[var(--mf-role-out)]' : 'text-accent',
          )}
        >
          <span key={kind} className="mf-flip-in flex">
            {isOut ? <Store className="h-5 w-5" /> : <UtensilsCrossed className="h-5 w-5" />}
          </span>
        </button>

        <span key={kind} className="mf-enter relative min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">
            {isOut ? t('detail.outTitle') : t('detail.pick')}
            {!isOut && myOrderNames.length > 0 && t('detail.picked', { n: myOrderNames.length })}
          </span>
          <span className="mt-0.5 block truncate text-xs text-secondary">
            {isOut
              ? (outSummary ?? t('detail.outSub'))
              : myOrderNames.length > 0
                ? myOrderNames.join(t('common.listSep'))
                : orderingOpen
                  ? t('order.cta')
                  : t('detail.orderEnded')}
          </span>
        </span>

        {isOut ? (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="mf-pressable mf-btn relative shrink-0 rounded-[var(--radius-chip)] bg-[var(--mf-role-out)] px-4 py-2 text-sm text-white shadow-[0_2px_8px_rgb(var(--mf-role-out-soft)/0.35)]"
          >
            {t('outing.log')}
          </button>
        ) : (
          orderingOpen && (
            <Link
              href={`/meals/${mealId}/order`}
              className="mf-accent-fill mf-pressable mf-btn relative shrink-0 rounded-[var(--radius-chip)] px-4 py-2 text-sm"
            >
              {myOrderNames.length > 0 ? t('order.edit') : t('order.go')}
            </Link>
          )
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent title={isOut ? t('mode.confirmHomeTitle') : t('mode.confirmOutTitle')}>
          {!isOut && totalOrders > 0 && (
            <p className="mb-4 text-sm text-secondary">{t('mode.confirmOutOrders', { n: totalOrders })}</p>
          )}
          <div className="flex gap-2">
            <Button variant="trough" className="flex-1" onClick={() => setConfirmOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              className={cn('flex-1', !isOut && '!bg-none !bg-[var(--mf-role-out)] !text-white')}
              onClick={doSwitch}
            >
              {isOut ? t('mode.confirmHomeDo') : t('mode.confirmOutDo')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {formOpen && (
        <OutingForm
          open={formOpen}
          onOpenChange={setFormOpen}
          mealId={mealId}
          value={outing}
          venues={venues}
          members={members}
          meId={meId}
        />
      )}
    </section>
  )
}
