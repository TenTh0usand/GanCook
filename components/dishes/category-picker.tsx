'use client'

import { cn } from '@/lib/utils'

export type CategoryOption = { id: string; name: string; parentId: string | null }

/**
 * 大类 / 细类点选（GanCook-10k · P2）。单选；再点一次已选的 = 取消。
 * 细类只显示所选大类下的。
 */
export function CategoryPicker({
  categories,
  category,
  subcategory,
  onChange,
  labelMain,
  labelSub,
}: {
  categories: CategoryOption[]
  category: string | null
  subcategory: string | null
  onChange: (category: string | null, subcategory: string | null) => void
  labelMain: string
  labelSub: string
}) {
  const parents = categories.filter((c) => !c.parentId)
  const subs = category ? categories.filter((c) => c.parentId === category) : []

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 pl-1 text-sm font-medium text-secondary">{labelMain}</p>
        <div className="flex flex-wrap gap-2">
          {parents.map((c) => (
            <Chip
              key={c.id}
              on={category === c.id}
              onClick={() => onChange(category === c.id ? null : c.id, null)}
            >
              {c.name}
            </Chip>
          ))}
        </div>
      </div>
      {subs.length > 0 && (
        <div>
          <p className="mb-1.5 pl-1 text-sm font-medium text-secondary">{labelSub}</p>
          <div className="flex flex-wrap gap-2">
            {subs.map((c) => (
              <Chip
                key={c.id}
                on={subcategory === c.id}
                onClick={() => onChange(category, subcategory === c.id ? null : c.id)}
              >
                {c.name}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'mf-pressable h-8 rounded-[var(--radius-chip)] px-3.5 text-[13px] font-medium transition-colors',
        on ? 'bg-[rgb(var(--mf-accent-soft)/0.16)] text-accent' : 'bg-trough text-secondary',
      )}
    >
      {children}
    </button>
  )
}
