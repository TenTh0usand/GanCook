'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { useT } from '@/components/i18n-provider'
import { createMeal } from '@/lib/actions/meals'
import { MEAL_TYPES, guessMealType, type MealType } from '@/lib/roles'

// GanCook-10k：加餐、夜宵
const DEFAULTS: Record<MealType, { dining: string; deadline: string }> = {
  breakfast: { dining: '07:30', deadline: '07:00' },
  lunch: { dining: '12:00', deadline: '10:00' },
  dinner: { dining: '18:30', deadline: '16:00' },
  snack: { dining: '15:30', deadline: '14:30' },
  late: { dining: '22:00', deadline: '21:00' },
}

export function CreateMealDialog({
  children,
  today,
  tomorrow,
}: {
  children: React.ReactNode
  today: string
  tomorrow: string
}) {
  const router = useRouter()
  const t = useT()
  const [open, setOpen] = useState(false)
  const [mealType, setMealType] = useState<MealType>('lunch')
  const [date, setDate] = useState(today)
  const [dining, setDining] = useState(DEFAULTS.lunch.dining)
  const [deadline, setDeadline] = useState(DEFAULTS.lunch.deadline)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const changeType = (next: MealType) => {
    setMealType(next)
    setDining(DEFAULTS[next].dining)
    setDeadline(DEFAULTS[next].deadline)
  }

  const handleOpenChange = (next: boolean) => {
    if (next) {
      const now = new Date()
      const guessed = guessMealType(now.getHours(), now.getMinutes())
      setMealType(guessed)
      setDining(DEFAULTS[guessed].dining)
      setDeadline(DEFAULTS[guessed].deadline)
      setDate(today)
      setError('')
    }
    setOpen(next)
  }

  const submit = () => {
    setError('')
    startTransition(async () => {
      const res = await createMeal({ mealType, date, diningTime: dining, deadline })
      if (res.ok) {
        setOpen(false)
        if (res.id) router.push(`/meals/${res.id}`)
        else router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent title={t('create.title')}>
        <div className="space-y-4">
          <div>
            <Label>{t('create.mealType')}</Label>
            <Segmented<MealType>
              value={mealType}
              onChange={changeType}
              layoutId="create-meal-type"
              className="[&_button]:px-1"
              options={MEAL_TYPES.map((m) => ({ value: m, label: t('meal.' + m) }))}
            />
          </div>

          <div>
            <Label>{t('create.date')}</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={date === today ? 'primary' : 'trough'}
                size="sm"
                onClick={() => setDate(today)}
              >
                {t('create.today')}
              </Button>
              <Button
                type="button"
                variant={date === tomorrow ? 'primary' : 'trough'}
                size="sm"
                onClick={() => setDate(tomorrow)}
              >
                {t('create.tomorrow')}
              </Button>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <Label>{t('create.diningTime')}</Label>
              <Input
                type="time"
                value={dining}
                onChange={(e) => setDining(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Label>{t('create.deadline')}</Label>
              <Input
                type="time"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button className="w-full" size="lg" loading={pending} onClick={submit}>
            {t('create.submit')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
