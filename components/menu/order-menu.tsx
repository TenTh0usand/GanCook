'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useT } from '@/components/i18n-provider'
import { MenuBrowser } from '@/components/menu/menu-browser'
import { toggleOrder } from '@/lib/actions/meals'
import type { MenuBrowserData } from '@/lib/menu-config'

/**
 * 全屏点菜页的客户端部分（GanCook-10k · P2 第 3 步）。
 * 菜单浏览组件（点菜模式）+ 底部「已点 N 道 · 选好了」栏；点一下立即生效（乐观更新，失败回滚）。
 */
export function OrderMenu({
  mealId,
  title,
  subtitle,
  data,
  initialPicked,
}: {
  mealId: string
  title: string
  subtitle: string
  data: MenuBrowserData
  initialPicked: string[]
}) {
  const t = useT()
  const router = useRouter()
  const [picked, setPicked] = React.useState<Set<string>>(new Set(initialPicked))
  const [error, setError] = React.useState('')
  const [, startTransition] = React.useTransition()

  const toggle = (dishId: string) => {
    setError('')
    const was = picked.has(dishId)
    const flip = (on: boolean) =>
      setPicked((cur) => {
        const next = new Set(cur)
        if (on) next.add(dishId)
        else next.delete(dishId)
        return next
      })
    flip(!was)
    startTransition(async () => {
      const res = await toggleOrder(mealId, dishId)
      if (!res.ok) {
        flip(was)
        setError(res.error)
      }
    })
  }

  const names = [...picked].map((id) => data.dishes[id]?.name).filter(Boolean)

  return (
    <>
      <MenuBrowser
        data={data}
        picked={picked}
        onToggle={toggle}
        header={
          <header className="mb-4">
            <Link href={`/meals/${mealId}`} className="-ml-1 inline-flex items-center text-secondary">
              <ChevronLeft className="h-5 w-5" />
              {t('order.back')}
            </Link>
            <h1 className="mt-2 tracking-title text-2xl font-bold text-ink">{title}</h1>
            <p className="mt-0.5 text-sm text-secondary">{subtitle}</p>
          </header>
        }
      />

      {/* 底部已点栏（点菜页隐藏底部导航，用它代替） */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <div className="pointer-events-auto w-full max-w-md">
          {error && (
            <p className="mb-2 rounded-2xl bg-danger px-4 py-2 text-center text-sm text-white">{error}</p>
          )}
          <div className="flex items-center gap-3 rounded-full bg-[var(--mf-ink)] py-2 pl-5 pr-2 shadow-[0_6px_20px_rgba(31,42,34,0.28)]">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-white">
                {picked.size > 0 ? t('order.pickedN', { n: picked.size }) : t('order.pickedNone')}
              </p>
              {names.length > 0 && (
                <p className="truncate text-xs text-white/65">{names.join(t('common.listSep'))}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                router.push(`/meals/${mealId}`)
                router.refresh()
              }}
              className="mf-accent-fill mf-pressable h-11 shrink-0 rounded-full px-6 text-[15px] font-bold"
            >
              {t('order.done')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
