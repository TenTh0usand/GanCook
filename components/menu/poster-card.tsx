'use client'

import * as React from 'react'
import Image from 'next/image'
import { Check, Soup } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BrowserDish } from '@/lib/menu-config'

/**
 * 时令海报（GanCook-10k · P2）：横向滑动的大卡片。
 * 有海报图用海报图，没有就用菜品照片；都没有用淡绿色调面 + 图标。
 */
export const PosterCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    dish: BrowserDish
    title: string
    posterPath: string | null
    cookedLabel: string
    picked?: boolean
  }
>(({ dish, title, posterPath, cookedLabel, picked, className, onKeyDown, ...props }, ref) => {
  const img = posterPath ?? dish.imagePath
  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        onKeyDown?.(e)
        if (!e.defaultPrevented && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          e.currentTarget.click()
        }
      }}
      className={cn(
        'group mf-pressable relative h-[128px] w-[76%] shrink-0 snap-start overflow-hidden rounded-[var(--radius-list)]',
        !img && 'mf-tonal',
        picked && 'ring-2 ring-accent ring-offset-2 ring-offset-base',
        className,
      )}
      {...props}
    >
      {img ? (
        <>
          <Image
            src={`/api/uploads/${img}`}
            alt={dish.name}
            fill
            sizes="320px"
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          />
          {/* 左侧渐变，保证文字可读 */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/25 to-transparent" />
        </>
      ) : (
        <Soup
          className="absolute -right-2 bottom-1 h-24 w-24 text-accent/20"
          strokeWidth={1.2}
        />
      )}
      <div className="relative flex h-full flex-col justify-between p-4">
        <span
          className={cn(
            'w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
            img ? 'bg-white/90 text-accent' : 'bg-surface text-accent',
          )}
        >
          {title}
        </span>
        <div>
          <p className={cn('text-lg font-bold tracking-title', img ? 'text-white' : 'text-ink')}>
            {dish.name}
          </p>
          <p className={cn('mt-0.5 text-xs', img ? 'text-white/85' : 'text-secondary')}>{cookedLabel}</p>
        </div>
      </div>
      {picked && (
        <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-accent-strong text-on-accent">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      )}
    </div>
  )
})
PosterCard.displayName = 'PosterCard'
