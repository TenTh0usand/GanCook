import * as React from 'react'
import Image from 'next/image'
import { Soup } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Dish } from '@/lib/db/schema'

/**
 * 菜品卡片（展示型）。作为 DialogTrigger 子节点时需要转发 ref/props。
 * GanCook-10k（P2）：可显示「做过 N 次」、分类、家常精选 / 新菜角标。
 */
export const DishCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    dish: Dish
    dimmed?: boolean
    /** 做过次数（不传则不显示） */
    cooked?: number
    cookedLabel?: string
    categoryName?: string | null
    isNew?: boolean
    newLabel?: string
    pinnedLabel?: string
  }
>(
  (
    {
      dish,
      dimmed,
      cooked,
      cookedLabel,
      categoryName,
      isNew,
      newLabel,
      pinnedLabel,
      className,
      ...props
    },
    ref,
  ) => {
    const meta = [categoryName, ...(dish.tags ?? []).slice(0, 2)].filter(Boolean).join(' · ')
    return (
      <div
        ref={ref}
        className={cn(
          'mf-raised mf-pressable overflow-hidden p-0 text-left',
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
              sizes="(max-width: 480px) 50vw, 220px"
              className="object-cover"
            />
          ) : (
            <div className="mf-img-empty flex h-full w-full items-center justify-center">
              <Soup className="h-9 w-9 text-accent/35" strokeWidth={1.5} />
            </div>
          )}
          {(isNew || dish.pinned) && (
            <div className="absolute left-2 top-2 flex gap-1">
              {dish.pinned && pinnedLabel && (
                <span className="rounded-full bg-accent-strong px-2 py-0.5 text-[10px] font-semibold text-white">
                  {pinnedLabel}
                </span>
              )}
              {isNew && newLabel && (
                <span className="rounded-full bg-[var(--mf-role-prep)] px-2 py-0.5 text-[10px] font-semibold text-white">
                  {newLabel}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="relative p-3.5">
          <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink">
            {dish.name}
          </h3>
          {meta ? (
            <p className="mt-0.5 truncate text-xs text-secondary">{meta}</p>
          ) : dish.description ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-secondary">{dish.description}</p>
          ) : null}
          {typeof cooked === 'number' && cookedLabel && (
            <p
              className={cn(
                'mt-1 text-xs font-medium',
                cooked > 0 ? 'text-accent' : 'text-secondary/60',
              )}
            >
              {cookedLabel}
            </p>
          )}
        </div>
      </div>
    )
  },
)
DishCard.displayName = 'DishCard'
