'use client'

import { cn } from '@/lib/utils'

/**
 * Milk Fabric 开关：trough 轨道 + 浮起白色滑钮，开启时轨道变青菜绿。
 * 采用纯 GPU transform 位移替代 left 过渡，避免重排卡顿。
 */
export function Switch({
  checked,
  onChange,
  disabled,
  color,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  color?: string
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'group relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50',
        checked ? (color ? '' : 'bg-accent-strong') : 'mf-inset',
      )}
      style={checked && color ? { background: color } : undefined}
    >
      <span
        className={cn(
          'pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-active:scale-95',
          checked ? 'translate-x-5' : 'translate-x-0',
          checked && !color ? 'bg-on-accent' : 'bg-white',
        )}
      />
    </button>
  )
}
