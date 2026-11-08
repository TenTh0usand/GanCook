'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { reviews } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/user'
import { getMeal } from '@/lib/meals'
import { getT } from '@/lib/i18n/server'
import { SCORE_DIMS, clampScore, overallFromDims, type ScoreDim, type ScoreMode } from '@/lib/scoring'

export type ActionResult = { ok: true } | { ok: false; error: string }

/**
 * 提交 / 更新餐后评价（每人每饭局一条）。
 * GanCook-10k（P3）：简易 / 科学两种评分，分数 ×10 存整数；rating 同步为四舍五入的整数星（兼容老逻辑）。
 * 轻量原则：超出范围的分数自动夹到 1.0–5.0；科学评分没给综合分时自动取维度平均。
 */
export async function submitReview(
  mealId: string,
  input: {
    mode?: ScoreMode
    /** 综合分 ×10（简易评分 = 打的分） */
    score?: number | null
    dims?: Partial<Record<ScoreDim, number | null>>
    comment?: string
    /** 兼容旧调用：整数星 */
    rating?: number
  },
): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  const meal = getMeal(mealId)
  if (!meal) return { ok: false, error: t('err.mealNotFound') }
  if (meal.status !== 'done') return { ok: false, error: t('err.eatFirst') }

  const mode: ScoreMode = input.mode === 'sci' ? 'sci' : 'simple'
  let dims: Partial<Record<ScoreDim, number>> | null = null
  if (mode === 'sci' && input.dims) {
    dims = {}
    for (const d of SCORE_DIMS) {
      const v = clampScore(input.dims[d] ?? null)
      if (v != null) dims[d] = v
    }
    if (Object.keys(dims).length === 0) dims = null
  }
  const score =
    clampScore(input.score ?? null) ??
    (dims ? overallFromDims(dims) : null) ??
    clampScore(input.rating != null ? input.rating * 10 : null)
  if (score == null) return { ok: false, error: t('review.needStar') }

  const comment = (input.comment ?? '').trim().slice(0, 200) || null
  const values = {
    scoreX10: score,
    rating: Math.min(5, Math.max(1, Math.round(score / 10))),
    mode,
    dims,
    comment,
  }

  const existing = db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.mealId, mealId), eq(reviews.userId, me.id)))
    .get()

  if (existing) {
    db.update(reviews).set(values).where(eq(reviews.id, existing.id)).run()
  } else {
    db.insert(reviews).values({ mealId, userId: me.id, ...values }).run()
  }
  revalidatePath(`/meals/${mealId}`)
  revalidatePath('/meals')
  revalidatePath('/home')
  return { ok: true }
}
