'use client'

import { cn } from '@/lib/utils'

/**
 * Milk Fabric 开关：trough 轨道 + 浮起白色滑钮，开启时轨道变青菜绿。
 * GanCook-10k：可选 color，用于角色开关（备菜橙 / 善后蓝…），不传则保持原样。
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
        'relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50',
        checked ? (color ? '' : 'bg-accent-strong') : 'mf-inset',
      )}
      style={checked && color ? { background: color } : undefined}
    >
      <span
        className={cn(
          'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all',
          checked ? 'left-6' : 'left-1',
        )}
      />
    </button>
  )
}
