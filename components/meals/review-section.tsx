'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/avatar'
import { HalfStars, ScoreInput } from '@/components/ui/half-stars'
import { RadarChart } from '@/components/ui/radar-chart'
import { Segmented } from '@/components/ui/segmented'
import { Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/i18n-provider'
import { submitReview } from '@/lib/actions/reviews'
import {
  SCORE_DIMS,
  averageDims,
  fmtScore,
  overallFromDims,
  type ScoreDim,
  type ScoreMode,
} from '@/lib/scoring'
import type { ReviewDetail } from '@/lib/meals'

/**
 * 餐后评分（GanCook-10k · P3 改造）。
 * - 简易（默认）：半颗星 / 输入 1.0–5.0，打个大概印象分
 * - 科学：六个维度 + 实时雷达图；综合分暂取平均（算法待定），可以手动改
 * 每人每餐一份，随时可改；下方显示全家平均（有科学评分时显示平均雷达图）和其他人的评分。
 */
export function ReviewSection({
  mealId,
  reviews,
  meId,
}: {
  mealId: string
  reviews: ReviewDetail[]
  meId: string
}) {
  const router = useRouter()
  const t = useT()
  const mine = reviews.find((r) => r.userId === meId)
  const scoreOf = (r: ReviewDetail) => r.scoreX10 ?? r.rating * 10

  const [mode, setMode] = useState<ScoreMode>(mine?.mode ?? 'simple')
  const [simple, setSimple] = useState<number | null>(mine ? scoreOf(mine) : null)
  const [dims, setDims] = useState<Partial<Record<ScoreDim, number | null>>>(mine?.dims ?? {})
  // 科学评分的综合分：没手动改过就跟着维度平均走
  const [overallOverride, setOverallOverride] = useState<number | null>(
    mine?.mode === 'sci' && mine.dims && scoreOf(mine) !== overallFromDims(mine.dims) ? scoreOf(mine) : null,
  )
  const [comment, setComment] = useState(mine?.comment ?? '')
  const [msg, setMsg] = useState('')
  const [isErr, setIsErr] = useState(false)
  const [pending, startTransition] = useTransition()

  const autoOverall = overallFromDims(dims)
  const sciOverall = overallOverride ?? autoOverall
  const labels = Object.fromEntries(SCORE_DIMS.map((d) => [d, t(`score.dim.${d}`)])) as Record<ScoreDim, string>

  const others = reviews.filter((r) => r.userId !== meId)
  const avg = reviews.length > 0 ? Math.round(reviews.reduce((a, r) => a + scoreOf(r), 0) / reviews.length) : null
  const sciList = reviews.filter((r) => r.mode === 'sci' && r.dims).map((r) => r.dims!)
  const familyDims = sciList.length > 0 ? averageDims(sciList) : null

  const submit = () => {
    setMsg('')
    const score = mode === 'simple' ? simple : sciOverall
    if (score == null) {
      setIsErr(true)
      return setMsg(t('review.needStar'))
    }
    startTransition(async () => {
      const res = await submitReview(mealId, {
        mode,
        score,
        dims: mode === 'sci' ? dims : undefined,
        comment,
      })
      setIsErr(!res.ok)
      if (res.ok) {
        setMsg(t('review.submitted'))
        router.refresh()
      } else setMsg(res.error)
    })
  }

  return (
    <section className="mt-6">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-ink">
        {t('review.title')}
        {avg != null && (
          <span className="inline-flex items-center gap-1 text-sm font-normal text-[#b3791f]">
            {t('score.familyAvg', { n: fmtScore(avg), k: reviews.length })}
          </span>
        )}
      </h2>

      {/* 我的评分 */}
      <div className="mf-raised p-4">
        <div className="relative mb-3 flex items-center justify-between gap-3">
          <span className="text-sm text-secondary">{mine ? t('review.editMine') : t('review.mine')}</span>
          <Segmented<ScoreMode>
            value={mode}
            onChange={setMode}
            layoutId="score-mode"
            className="w-[150px] [&_button]:py-1.5 [&_button]:text-xs"
            options={[
              { value: 'simple', label: t('score.simple') },
              { value: 'sci', label: t('score.sci') },
            ]}
          />
        </div>

        {mode === 'simple' ? (
          <div className="relative">
            <ScoreInput value={simple} onChange={setSimple} size={30} label={t('score.simple')} />
            <p className="mt-1.5 text-xs text-secondary">{t('score.simpleHint')}</p>
          </div>
        ) : (
          <div className="relative">
            <div className="flex justify-center">
              <RadarChart values={dims} compare={familyDims ?? undefined} labels={labels} size={220} />
            </div>
            <div className="mt-1 space-y-2">
              {SCORE_DIMS.map((d) => (
                <div key={d} className="flex items-center justify-between gap-2">
                  <span className="w-14 shrink-0 text-sm text-ink">{labels[d]}</span>
                  <ScoreInput
                    value={dims[d] ?? null}
                    onChange={(v) => setDims((cur) => ({ ...cur, [d]: v }))}
                    size={18}
                    compact
                    label={labels[d]}
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-black/[0.05] pt-3">
              <div>
                <p className="text-sm font-semibold text-ink">{t('score.overall')}</p>
                <p className="text-[11px] text-secondary">
                  {overallOverride != null ? t('score.overallManual') : t('score.overallAuto')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {overallOverride != null && (
                  <button type="button" className="text-xs text-accent" onClick={() => setOverallOverride(null)}>
                    {t('score.useAvg')}
                  </button>
                )}
                <ScoreInput value={sciOverall} onChange={setOverallOverride} size={16} compact label={t('score.overall')} />
              </div>
            </div>
            {familyDims && <p className="mt-2 text-[11px] text-secondary">{t('score.radarLegend')}</p>}
          </div>
        )}

        <Textarea
          className="relative mt-3"
          placeholder={t('review.commentPh')}
          value={comment}
          maxLength={200}
          onChange={(e) => setComment(e.target.value)}
        />
        <div className="relative mt-3 flex items-center gap-3">
          <Button size="sm" loading={pending} onClick={submit}>
            {mine ? t('review.update') : t('review.submit')}
          </Button>
          {msg && <span className={isErr ? 'text-sm text-danger' : 'text-sm text-accent'}>{msg}</span>}
        </div>
      </div>

      {/* 全家平均雷达（有人用科学评分时） */}
      {familyDims && mode === 'simple' && (
        <div className="mf-raised mt-3 flex items-center gap-3 p-3">
          <RadarChart values={familyDims} labels={labels} size={150} color="#e0a13a" />
          <div className="min-w-0 flex-1 space-y-1 text-xs">
            <p className="mb-1 text-sm font-semibold text-ink">{t('score.familyRadar', { k: sciList.length })}</p>
            {SCORE_DIMS.map((d) => (
              <p key={d} className="flex justify-between text-secondary">
                <span>{labels[d]}</span>
                <span className="font-semibold text-ink">{fmtScore(familyDims[d] ?? null)}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {/* 其他人的评分 */}
      {others.length > 0 && (
        <div className="mt-3 space-y-2.5">
          {others.map((r) => (
            <div key={r.id} className="mf-raised flex gap-3 p-3">
              <Avatar
                name={r.userName}
                src={r.userAvatar ? `/api/uploads/${r.userAvatar}` : null}
                size={36}
              />
              <div className="relative min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-sm font-medium text-ink">{r.userName}</span>
                  <HalfStars value={scoreOf(r)} size={14} />
                  <span className="text-sm font-bold text-[#b3791f]">{fmtScore(scoreOf(r))}</span>
                  {r.mode === 'sci' && (
                    <span className="rounded-full bg-[rgb(var(--mf-accent-soft)/0.15)] px-1.5 py-[1px] text-[10px] font-semibold text-accent">
                      {t('score.sci')}
                    </span>
                  )}
                </div>
                {r.mode === 'sci' && r.dims && (
                  <p className="mt-0.5 text-[11px] text-secondary">
                    {SCORE_DIMS.filter((d) => r.dims![d])
                      .map((d) => `${labels[d]} ${fmtScore(r.dims![d] ?? null)}`)
                      .join(' · ')}
                  </p>
                )}
                {r.comment && <p className="mt-0.5 text-sm text-secondary">{r.comment}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
