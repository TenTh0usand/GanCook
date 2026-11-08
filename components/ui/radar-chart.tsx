import { SCORE_DIMS, type ScoreDim } from '@/lib/scoring'

/**
 * 正六边形雷达图（GanCook-10k · P3，手写 SVG，不引入图表库）。
 * values：各维度 ×10 分数（10–50），没打的维度画在中心。
 * compare：可选的对比数据（如全家平均），用虚线画在底层。
 */
export function RadarChart({
  values,
  compare,
  labels,
  size = 200,
  color = 'var(--mf-accent)',
}: {
  values: Partial<Record<ScoreDim, number | null>>
  compare?: Partial<Record<ScoreDim, number | null>>
  labels: Record<ScoreDim, string>
  size?: number
  color?: string
}) {
  const pad = 30
  const c = size / 2
  const R = c - pad
  const angle = (i: number) => -Math.PI / 2 + (i * Math.PI) / 3
  const pt = (i: number, r: number) => [c + r * Math.cos(angle(i)), c + r * Math.sin(angle(i))] as const
  const poly = (vals: Partial<Record<ScoreDim, number | null>>) =>
    SCORE_DIMS.map((d, i) => {
      const v = vals[d] ?? 0
      return pt(i, (R * Math.max(0, v)) / 50).join(',')
    }).join(' ')

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="radar">
      {/* 网格：5 / 3 / 1 分三圈 */}
      {[1, 0.6, 0.2].map((k) => (
        <polygon
          key={k}
          points={SCORE_DIMS.map((_, i) => pt(i, R * k).join(',')).join(' ')}
          fill={k === 1 ? 'var(--mf-trough)' : 'none'}
          fillOpacity={k === 1 ? 0.5 : 0}
          stroke="rgb(var(--mf-shadow) / 0.15)"
        />
      ))}
      {SCORE_DIMS.map((_, i) => {
        const [x, y] = pt(i, R)
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="rgb(var(--mf-shadow) / 0.1)" />
      })}
      {compare && (
        <polygon
          points={poly(compare)}
          fill="none"
          stroke="var(--mf-secondary)"
          strokeOpacity={0.6}
          strokeDasharray="4 3"
          strokeWidth={1.5}
        />
      )}
      <polygon points={poly(values)} fill={color} fillOpacity={0.22} stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {SCORE_DIMS.map((d, i) => {
        const v = values[d]
        if (!v) return null
        const [x, y] = pt(i, (R * v) / 50)
        return <circle key={d} cx={x} cy={y} r={2.8} fill={color} />
      })}
      {SCORE_DIMS.map((d, i) => {
        const [x, y] = pt(i, R + 16)
        return (
          <text
            key={d}
            x={x}
            y={y + 4}
            textAnchor="middle"
            fontSize={11}
            fill="var(--mf-secondary)"
            fontWeight={500}
          >
            {labels[d]}
          </text>
        )
      })}
    </svg>
  )
}
