import { dayjs } from '@/lib/time'

const LEVEL_ALPHA = [0, 0.42, 0.62, 0.82, 1]
/** 按天去重的角色（备菜 / 善后）只有「有 / 没有」，用固定深度 */
const BINARY_ALPHA = 0.85

function level(count: number): number {
  if (count <= 0) return 0
  if (count >= 4) return 4
  return count
}

/**
 * GitHub 风格贡献热力图（服务端渲染，hover 用 title）。
 * 列 = 周，行 = 周日..周六；强度按当天次数着色。
 *
 * GanCook-10k 扩展：
 * - softVar：角色色的 RGB 变量名（默认青菜绿），四种角色各用自己的颜色
 * - binary：按天去重（备菜 / 善后），有记录就是一个固定深度
 * - raw：悬停提示里显示当天的原始次数
 */
export function ContributionHeatmap({
  data,
  today,
  weeks = 26,
  label,
  softVar = '--mf-accent-soft',
  binary = false,
  raw,
  unit = '次',
  cellSize = 11,
}: {
  data: Record<string, number>
  today: string
  weeks?: number
  label?: string
  softVar?: string
  binary?: boolean
  raw?: Record<string, number>
  unit?: string
  cellSize?: number
}) {
  const end = dayjs(today)
  let gridStart = end.subtract(weeks * 7 - 1, 'day')
  gridStart = gridStart.subtract(gridStart.day(), 'day') // 回到周日
  const numCols = Math.ceil((end.diff(gridStart, 'day') + 1) / 7)

  const cols: { date: string | null; count: number }[][] = []
  for (let c = 0; c < numCols; c++) {
    const col: { date: string | null; count: number }[] = []
    for (let r = 0; r < 7; r++) {
      const d = gridStart.add(c * 7 + r, 'day')
      if (d.isAfter(end)) {
        col.push({ date: null, count: 0 })
      } else {
        const ds = d.format('YYYY-MM-DD')
        col.push({ date: ds, count: data[ds] ?? 0 })
      }
    }
    cols.push(col)
  }

  const size = { height: cellSize, width: cellSize }

  return (
    <div>
      {label && (
        <p className="mb-1.5 text-xs font-medium text-secondary">{label}</p>
      )}
      <div className="overflow-x-auto">
        <div className="flex gap-[3px]">
          {cols.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-[3px]">
              {col.map((cell, ri) => {
                if (!cell.date) return <div key={ri} style={size} />
                const lv = level(cell.count)
                const alpha = binary ? BINARY_ALPHA : LEVEL_ALPHA[lv]
                const n = raw?.[cell.date] ?? cell.count
                return (
                  <div
                    key={ri}
                    title={`${cell.date} · ${n} ${unit}`}
                    className="rounded-[3px]"
                    style={{
                      ...size,
                      background:
                        lv === 0 ? 'var(--mf-trough)' : `rgb(var(${softVar}) / ${alpha})`,
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
