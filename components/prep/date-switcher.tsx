'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useT } from '@/components/i18n-provider'

/**
 * 备菜页的日期切换（GanCook-10k · P4）：今天 / 昨天 / 选日期，用 ?date= 参数，刷新也保持。
 */
export function DateSwitcher({ date, today, yesterday }: { date: string; today: string; yesterday: string }) {
  const t = useT()
  const router = useRouter()
  const go = (d: string) => router.push(d === today ? '/prep' : `/prep?date=${d}`)
  const chip = (d: string, label: string) => (
    <button
      type="button"
      onClick={() => go(d)}
      className={cn(
        'mf-pressable h-9 rounded-full px-4 text-sm font-medium',
        date === d ? 'mf-accent-fill' : 'bg-trough text-secondary',
      )}
    >
      {label}
    </button>
  )
  return (
    <div className="mb-4 flex items-center gap-2">
      {chip(today, t('date.today'))}
      {chip(yesterday, t('date.yesterday'))}
      <input
        type="date"
        value={date}
        max={today}
        onChange={(e) => e.target.value && go(e.target.value)}
        className="mf-inset h-9 min-w-0 flex-1 rounded-full px-3 text-sm text-ink outline-none"
      />
    </div>
  )
}
