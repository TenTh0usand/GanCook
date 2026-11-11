'use client'

import * as React from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtScore, parseScoreText } from '@/lib/scoring'

const GOLD = '#f0b429'

/**
 * 半星评分（GanCook-10k · P3）。value / onChange 都是 ×10 的分数（4.5 → 45）。
 * - 可交互：点星星左半边 = 半颗，右半边 = 整颗
 * - 只读：按实际分数精确填充（4.3 → 第 5 颗填 30%）
 */
export function HalfStars({
  value,
  onChange,
  size = 22,
  className,
}: {
  value: number | null
  onChange?: (x10: number) => void
  size?: number
  className?: string
}) {
  const v = value ?? 0
  return (
    <div className={cn('inline-flex items-center gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, (v - (n - 1) * 10) / 10))
        return (
          <span key={n} className="relative inline-block" style={{ width: size, height: size }}>
            <Star style={{ width: size, height: size }} className="absolute inset-0 fill-none text-secondary/35" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star style={{ width: size, height: size, color: GOLD, fill: GOLD }} />
            </span>
            {onChange && (
              <>
                <button
                  type="button"
                  aria-label={`${n - 0.5}`}
                  className="absolute inset-y-0 left-0 w-1/2"
                  onClick={() => onChange(n * 10 - 5)}
                />
                <button
                  type="button"
                  aria-label={`${n}`}
                  className="absolute inset-y-0 right-0 w-1/2"
                  onClick={() => onChange(n * 10)}
                />
              </>
            )}
          </span>
        )
      })}
    </div>
  )
}

/**
 * 评分输入（GanCook-10k · P3）：半星 + 数字框（1.0–5.0，一位小数）。
 * 数字框随便输：失焦时自动规范（超范围夹到 1.0–5.0，看不懂的输入恢复原值），不弹报错。
 */
export function ScoreInput({
  value,
  onChange,
  size = 24,
  compact = false,
  label,
}: {
  value: number | null
  onChange: (x10: number) => void
  size?: number
  /** 紧凑模式（科学评分的每个维度） */
  compact?: boolean
  label?: string
}) {
  const [draft, setDraft] = React.useState<string | null>(null)
  const display = draft ?? (value != null ? fmtScore(value) : '')

  const commit = () => {
    if (draft == null) return
    const v = parseScoreText(draft)
    setDraft(null)
    if (v != null) onChange(v)
  }

  return (
    <div className="flex items-center gap-2">
      <HalfStars
        value={value}
        onChange={(v) => {
          setDraft(null)
          onChange(v)
        }}
        size={size}
      />
      <input
        value={display}
        inputMode="decimal"
        aria-label={label}
        placeholder="–"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className={cn(
          'mf-inset rounded-xl text-center font-bold text-ink outline-none',
          compact ? 'h-8 w-12 text-sm' : 'h-10 w-16 text-base',
        )}
      />
    </div>
  )
}
