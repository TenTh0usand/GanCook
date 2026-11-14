'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { CalendarDays, Search, X } from 'lucide-react'
import { useT } from '@/components/i18n-provider'
import { Segmented } from '@/components/ui/segmented'

type KindFilter = 'all' | 'home' | 'out'

/** 饭局页 · 历史搜索：按日期定位 + 按菜名 / 饭局名搜（写入 URL ?date=&q=，刷新可保留） */
export function MealSearch({ date, q, kind = 'all' }: { date: string; q: string; kind?: KindFilter }) {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  const [text, setText] = useState(q)
  const first = useRef(true)

  const go = (nextDate: string, nextQ: string, nextKind: KindFilter = kind) => {
    const sp = new URLSearchParams()
    if (nextKind !== 'all') sp.set('kind', nextKind)
    if (nextDate) sp.set('date', nextDate)
    if (nextQ.trim()) sp.set('q', nextQ.trim())
    const qs = sp.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  // 输入停顿 300ms 再搜索
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const id = setTimeout(() => go(date, text), 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  const active = !!date || !!text.trim()

  return (
    <div className="mb-4 space-y-2.5">
    <Segmented<KindFilter>
      value={kind}
      onChange={(k) => go(date, text, k)}
      layoutId="meal-kind-filter"
      options={[
        { value: 'all', label: t('meals.filterAll') },
        { value: 'home', label: t('meals.filterHome') },
        { value: 'out', label: t('meals.filterOut') },
      ]}
    />
    <div className="flex gap-2">
      <label className="mf-inset flex h-10 min-w-0 flex-1 items-center gap-2 px-3">
        <Search className="h-4 w-4 shrink-0 text-secondary" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('meals.searchPh')}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-secondary/70"
        />
      </label>
      <label
        className="mf-inset relative flex h-10 shrink-0 items-center gap-1.5 px-3 text-sm"
        title={t('meals.searchDate')}
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-secondary" />
        <span className={date ? 'text-ink' : 'text-secondary'}>{date ? date.slice(5).replace('-', '/') : t('meals.searchDate')}</span>
        <input
          type="date"
          aria-label={t('meals.searchDate')}
          value={date}
          onChange={(e) => go(e.target.value, text)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      {active && (
        <button
          type="button"
          onClick={() => {
            setText('')
            go('', '', kind)
          }}
          className="mf-pressable flex h-10 shrink-0 items-center gap-1 rounded-[var(--radius-control)] px-2.5 text-sm text-secondary hover:text-ink"
        >
          <X className="h-4 w-4" />
          {t('meals.searchClear')}
        </button>
      )}
    </div>
    </div>
  )
}
