'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Crown, Maximize2 } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { useT } from '@/components/i18n-provider'
import { togglePhotoVote } from '@/lib/actions/photos'
import { Lightbox } from '@/components/photos/lightbox'
import { cn } from '@/lib/utils'

export type VotePhoto = {
  id: string
  path: string
  thumbPath: string
  voters: { id: string; name: string; avatarPath: string | null }[]
}

/**
 * 「哪道菜最能代表这顿饭？」：点照片投票（每人每顿一票，点另一张改票，再点同一张撤票）。
 * 第一名左上角小皇冠，自己投的那张有勾；得票最多的照片会成为饭局列表的封面。
 */
export function PhotoVote({
  mealId,
  photos,
  me,
  coverId,
}: {
  mealId: string
  photos: VotePhoto[]
  me: { id: string; name: string; avatarPath: string | null }
  /** 当前封面（得票最多 / 固定随机） */
  coverId: string | null
}) {
  const t = useT()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [mine, setMine] = useState<string | null>(photos.find((p) => p.voters.some((v) => v.id === me.id))?.id ?? null)
  const [open, setOpen] = useState<number | null>(null)

  // 乐观更新：本地先把我的票挪过去
  const view = photos.map((p) => {
    const others = p.voters.filter((v) => v.id !== me.id)
    return { ...p, voters: mine === p.id ? [...others, me] : others }
  })
  const totalVoters = new Set(view.flatMap((p) => p.voters.map((v) => v.id))).size
  const maxVotes = Math.max(0, ...view.map((p) => p.voters.length))

  const vote = (id: string) => {
    const prev = mine
    setMine(prev === id ? null : id)
    startTransition(async () => {
      const res = await togglePhotoVote(mealId, id)
      if (!res.ok) setMine(prev)
      router.refresh()
    })
  }

  return (
    <section className="mt-6">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-ink">{t('vote.title')}</h2>
        <p className="mt-0.5 text-xs text-secondary">
          {totalVoters > 0 ? t('vote.voters', { n: totalVoters }) : t('vote.hint')}
        </p>
      </div>
      <div className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {view.map((p, i) => {
          const isMine = mine === p.id
          const isTop = maxVotes > 0 && p.voters.length === maxVotes && p.id === coverId
          return (
            <div key={p.id} className="w-[30%] min-w-[104px] shrink-0 snap-start">
              <button
                type="button"
                onClick={() => vote(p.id)}
                aria-pressed={isMine}
                className={cn(
                  'mf-pressable relative block aspect-square w-full overflow-hidden rounded-[calc(var(--radius-field)*0.7)] bg-trough transition-shadow',
                  isMine ? 'shadow-[0_0_0_2.5px_var(--mf-accent)]' : 'shadow-[0_0_0_1px_var(--mf-hairline)]',
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/uploads/${p.thumbPath}`} alt="" loading="lazy" className="h-full w-full object-cover" />
                {isTop && (
                  <span className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#f0b429] text-white shadow">
                    <Crown className="h-3.5 w-3.5" />
                  </span>
                )}
                {isMine && (
                  <span className="mf-flip-in absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent-strong text-on-accent shadow">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                )}
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={t('photo.view')}
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpen(i)
                  }}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-white"
                >
                  <Maximize2 className="h-3 w-3" />
                </span>
              </button>
              <div className="mt-1.5 flex items-center gap-1.5 px-0.5">
                <span className="text-xs font-semibold text-ink">{t('vote.count', { n: p.voters.length })}</span>
                <span className="flex -space-x-1.5">
                  {p.voters.slice(0, 4).map((v) => (
                    <Avatar
                      key={v.id}
                      name={v.name}
                      src={v.avatarPath ? `/api/uploads/${v.avatarPath}` : null}
                      size={18}
                      className="ring-2 ring-[var(--mf-base)]"
                    />
                  ))}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      {open != null && (
        <Lightbox
          photos={view.map((p) => ({ id: p.id, path: p.path, thumbPath: p.thumbPath }))}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  )
}
