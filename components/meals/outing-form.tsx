'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { useT } from '@/components/i18n-provider'
import { saveOuting } from '@/lib/actions/outing'
import { OUT_CATEGORIES, OUT_EMOJI, type OutCategory } from '@/lib/roles'
import { cn } from '@/lib/utils'

export type OutingFormValue = {
  venueName: string | null
  category: OutCategory | null
  totalCents: number | null
  headcount: number | null
  paidCents: number | null
  companionIds: string[]
}

const yuan = (c: number | null) => (c == null ? '' : String(c / 100))

/** 「记一笔」外出：全部可以不填（店名会联想以前去过的店） */
export function OutingForm({
  open,
  onOpenChange,
  mealId,
  value,
  venues,
  members,
  meId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  mealId: string
  value: OutingFormValue
  venues: string[]
  members: { id: string; name: string; avatarPath: string | null }[]
  meId: string
}) {
  const t = useT()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [venue, setVenue] = useState(value.venueName ?? '')
  const [category, setCategory] = useState<OutCategory | null>(value.category)
  const [total, setTotal] = useState(yuan(value.totalCents))
  const [headcount, setHeadcount] = useState(value.headcount ? String(value.headcount) : '')
  const [paid, setPaid] = useState(
    value.paidCents != null && value.paidCents !== value.totalCents ? yuan(value.paidCents) : '',
  )
  const [companions, setCompanions] = useState<string[]>(
    value.companionIds.length ? value.companionIds : [meId],
  )

  const totalNum = parseFloat(total.replace(/[^\d.]/g, ''))
  const headNum = parseInt(headcount.replace(/[^\d]/g, ''), 10)
  const per = totalNum > 0 && headNum > 0 ? Math.round((totalNum / headNum) * 100) / 100 : null

  const toggleCompanion = (id: string) =>
    setCompanions((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  const submit = () =>
    startTransition(async () => {
      const res = await saveOuting(mealId, { venueName: venue, category, total, headcount, paid, companions })
      if (res.ok) {
        onOpenChange(false)
        router.refresh()
      }
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t('outing.formTitle')}>
        <div className="space-y-4">
          <div>
            <Label htmlFor="outing-venue">{t('outing.venue')}</Label>
            <Input
              id="outing-venue"
              list="outing-venues"
              value={venue}
              maxLength={30}
              onChange={(e) => setVenue(e.target.value)}
              placeholder={t('outing.venuePh')}
            />
            <datalist id="outing-venues">
              {venues.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </div>

          <div>
            <Label>{t('outing.category')}</Label>
            <div className="grid grid-cols-4 gap-2">
              {OUT_CATEGORIES.map((c) => {
                const on = category === c
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(on ? null : c)}
                    className={cn(
                      'mf-pressable flex h-11 items-center justify-center gap-1 rounded-[var(--radius-control)] text-sm',
                      on
                        ? 'bg-[rgb(var(--mf-role-out-soft)/0.18)] font-semibold text-[var(--mf-role-out)] shadow-[inset_0_0_0_1.5px_var(--mf-role-out)]'
                        : 'bg-trough text-secondary',
                    )}
                  >
                    <span>{OUT_EMOJI[c]}</span>
                    {t(`outing.cat.${c}`)}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="outing-total">{t('outing.total')}</Label>
              <Input
                id="outing-total"
                inputMode="decimal"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                placeholder="¥"
              />
            </div>
            <div>
              <Label htmlFor="outing-head">{t('outing.headcount')}</Label>
              <Input
                id="outing-head"
                inputMode="numeric"
                value={headcount}
                onChange={(e) => setHeadcount(e.target.value)}
                placeholder={String(companions.length || '')}
              />
            </div>
          </div>
          {per != null && (
            <p className="-mt-2 text-sm font-semibold text-[var(--mf-role-out)]">{t('outing.per', { n: per })}</p>
          )}

          <div>
            <Label htmlFor="outing-paid">{t('outing.paid')}</Label>
            <Input
              id="outing-paid"
              inputMode="decimal"
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              placeholder={t('outing.paidPh')}
            />
          </div>

          <div>
            <Label>{t('outing.companions')}</Label>
            <div className="flex flex-wrap gap-3">
              {members.map((m) => {
                const on = companions.includes(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleCompanion(m.id)}
                    className="mf-pressable flex w-14 flex-col items-center gap-1 text-xs"
                  >
                    <span className="relative">
                      <Avatar
                        name={m.name}
                        src={m.avatarPath ? `/api/uploads/${m.avatarPath}` : null}
                        size={44}
                        className={cn('transition-opacity', on ? 'opacity-100' : 'opacity-35')}
                      />
                      {on && (
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[var(--mf-role-out)] text-white ring-2 ring-[var(--mf-base)]">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      )}
                    </span>
                    <span className={cn('max-w-full truncate', on ? 'text-ink' : 'text-secondary')}>{m.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <Button className="w-full" size="lg" loading={pending} onClick={submit}>
            {t('outing.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
