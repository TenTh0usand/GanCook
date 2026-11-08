/**
 * 评分系统（GanCook-10k · P3）—— 纯常量和工具函数，服务端 / 客户端都能用。
 *
 * - 简易评分（默认）：半颗星点选，或输入 1.0–5.0（一位小数）
 * - 科学评分：六个维度各打一个分 → 正六边形雷达图；综合分算法待定，暂取已打分维度的平均，可手动改
 * - 所有分数 ×10 存整数（4.5 → 45），避免小数误差
 */

export const SCORE_DIMS = ['taste', 'texture', 'look', 'portion', 'value', 'experience'] as const
export type ScoreDim = (typeof SCORE_DIMS)[number]
export type ScoreMode = 'simple' | 'sci'

export const SCORE_MIN = 10
export const SCORE_MAX = 50

/** 规范化分数（×10）：超出范围夹到 1.0–5.0；不是数字返回 null */
export function clampScore(x10: number | null | undefined): number | null {
  if (x10 == null || !Number.isFinite(x10)) return null
  if (x10 <= 0) return null
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, Math.round(x10)))
}

/** 输入框文字 → 分数（×10）。「4.5」「4」「4.56」都行；不合法返回 null */
export function parseScoreText(text: string): number | null {
  const v = Number(text.trim().replace('，', '.').replace(',', '.'))
  if (!text.trim() || !Number.isFinite(v)) return null
  return clampScore(Math.round(v * 10))
}

/** 分数（×10）→ 显示文字「4.5」 */
export function fmtScore(x10: number | null | undefined): string {
  return x10 == null ? '–' : (x10 / 10).toFixed(1)
}

/**
 * 科学评分的综合分（×10）：暂取已打分维度的平均（算法待定，以后只改这里）。
 * 一个维度都没打返回 null。
 */
export function overallFromDims(dims: Partial<Record<ScoreDim, number | null>>): number | null {
  const vals = SCORE_DIMS.map((d) => dims[d]).filter((v): v is number => typeof v === 'number' && v > 0)
  if (vals.length === 0) return null
  return clampScore(vals.reduce((a, b) => a + b, 0) / vals.length)
}

/** 多份科学评分的逐维平均（全家平均雷达图用） */
export function averageDims(list: Partial<Record<ScoreDim, number>>[]): Partial<Record<ScoreDim, number>> {
  const res: Partial<Record<ScoreDim, number>> = {}
  for (const d of SCORE_DIMS) {
    const vals = list.map((x) => x[d]).filter((v): v is number => typeof v === 'number' && v > 0)
    if (vals.length > 0) res[d] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  }
  return res
}
