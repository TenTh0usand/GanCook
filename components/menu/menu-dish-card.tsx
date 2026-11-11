'use client'

import * as React from 'react'
import Image from 'next/image'
import { Check, Plus, Soup } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BrowserDish } from '@/lib/menu-config'

/**
 * 菜单里的紧凑菜品卡片（GanCook-10k · P2）：两列布局用。
 * 作为 DialogTrigger 子节点时需要转发 ref/props。
 * - 管理模式：整张卡片可点（打开菜品弹窗）
 * - 点菜模式：右下角 ＋ / ✓，整张卡片点一下即点 / 取消
 */
export const MenuDishCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    dish: BrowserDish
    labels: { cooked: string; never: string; isNew: string; pinned: string }
    /** 点菜模式：是否已点；undefined = 管理模式（不显示 ＋ / ✓） */
    picked?: boolean
    dimmed?: boolean
  }
>(({ dish, labels, picked, dimmed, className, onKeyDown, ...props }, ref) => {
  const orderMode = typeof picked === 'boolean'
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
        'mf-raised mf-pressable relative overflow-hidden p-0 text-left',
        picked && 'ring-2 ring-accent ring-offset-2 ring-offset-base',
        dimmed && 'opacity-50',
        className,
      )}
      {...props}
    >
      <div className="relative aspect-[4/3] w-full">
        {dish.imagePath ? (
          <Image
            src={`/api/uploads/${dish.imagePath}`}
            alt={dish.name}
            fill
            sizes="(max-width: 480px) 40vw, 170px"
            className="object-cover"
          />
        ) : (
          <div className="mf-img-empty flex h-full w-full items-center justify-center">
            <Soup className="h-7 w-7 text-accent/35" strokeWidth={1.5} />
          </div>
        )}
        {(dish.pinned || dish.isNew) && (
          <div className="absolute left-1.5 top-1.5 flex gap-1">
            {dish.pinned && (
              <span className="rounded-full bg-accent-strong px-1.5 py-[1px] text-[10px] font-semibold text-white">
                {labels.pinned}
              </span>
            )}
            {dish.isNew && (
              <span className="rounded-full bg-[var(--mf-role-prep)] px-1.5 py-[1px] text-[10px] font-semibold text-white">
                {labels.isNew}
              </span>
            )}
          </div>
        )}
      </div>
      <div className={cn('relative px-2.5 pb-2.5 pt-2', orderMode && 'pr-10')}>
        <h3 className="truncate text-[14px] font-semibold tracking-[-0.01em] text-ink">{dish.name}</h3>
        <p
          className={cn(
            'mt-0.5 truncate text-[11px]',
            dish.cookTotal > 0 ? 'font-medium text-accent' : 'text-secondary/60',
          )}
        >
          {dish.cookTotal > 0 ? labels.cooked : labels.never}
          {dish.categoryName && (
            <span className="font-normal text-secondary"> · {dish.categoryName}</span>
          )}
        </p>
        {orderMode && (
          <span
            className={cn(
              'absolute bottom-2.5 right-2.5 flex h-6 w-6 items-center justify-center rounded-full',
              picked ? 'bg-accent-strong text-white' : 'border-[1.5px] border-accent text-accent',
            )}
          >
            {picked ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />}
          </span>
        )}
      </div>
    </div>
  )
})
MenuDishCard.displayName = 'MenuDishCard'
