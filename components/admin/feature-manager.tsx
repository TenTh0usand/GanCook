'use client'

import * as React from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, ImagePlus, Plus, Search, Soup, Trash2, X } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/i18n-provider'
import { compressImage } from '@/lib/client/compress-image'
import { cn } from '@/lib/utils'
import { createFeature, deleteFeature, moveFeature, updateFeature } from '@/lib/actions/menu-admin'

export type FeatureRow = {
  id: string
  dishId: string
  title: string | null
  posterPath: string | null
  startDate: string | null
  endDate: string | null
}

export type FeatureDishOption = { id: string; name: string; imagePath: string | null; cookTotal: number }

/**
 * 本季推荐管理（GanCook-10k · P2 第 4 步）。
 * 指定的菜会出现在菜单顶部海报；都不在有效期内时自动回到「最近 3 个月做得最多」。
 */
export function FeatureManager({
  features,
  dishes,
  today,
}: {
  features: FeatureRow[]
  dishes: FeatureDishOption[]
  today: string
}) {
  const t = useT()
  const router = useRouter()
  const [editing, setEditing] = React.useState<FeatureRow | 'new' | null>(null)
  const [pending, startTransition] = React.useTransition()
  const byId = new Map(dishes.map((d) => [d.id, d]))

  const status = (f: FeatureRow) =>
    f.startDate && f.startDate > today
      ? { label: t('feature.upcoming'), cls: 'bg-trough text-secondary' }
      : f.endDate && f.endDate < today
        ? { label: t('feature.ended'), cls: 'bg-trough text-secondary/70' }
        : { label: t('feature.live'), cls: 'bg-[rgb(var(--mf-accent-soft)/0.15)] text-accent' }
  const range = (f: FeatureRow) =>
    !f.startDate && !f.endDate
      ? t('feature.anytime')
      : `${f.startDate ? f.startDate.slice(5).replace('-', '/') : '…'} – ${f.endDate ? f.endDate.slice(5).replace('-', '/') : '…'}`

  const move = (id: string, dir: -1 | 1) =>
    startTransition(async () => {
      await moveFeature(id, dir)
      router.refresh()
    })

  return (
    <>
      <div className="mf-list">
        {features.length === 0 && (
          <div className="mf-row text-sm text-secondary">{t('feature.none')}</div>
        )}
        {features.map((f, i) => {
          const d = byId.get(f.dishId)
          const img = f.posterPath ?? d?.imagePath ?? null
          const st = status(f)
          return (
            <div key={f.id} className="mf-row">
              <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setEditing(f)}>
                <span className="relative flex h-11 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-trough">
                  {img ? (
                    <Image src={`/api/uploads/${img}`} alt="" fill sizes="64px" className="object-cover" />
                  ) : (
                    <Soup className="h-5 w-5 text-accent/40" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[15px] font-medium text-ink">{d?.name ?? '—'}</span>
                    <span className={cn('shrink-0 rounded-full px-1.5 py-[1px] text-[10px] font-semibold', st.cls)}>{st.label}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-secondary">
                    {(f.title || t('menu.seasonal')) + ' · ' + range(f)}
                  </span>
                </span>
              </button>
              <span className="flex shrink-0 gap-1">
                <button type="button" aria-label="up" disabled={pending || i === 0} onClick={() => move(f.id, -1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-trough text-secondary disabled:opacity-35">
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button type="button" aria-label="down" disabled={pending || i === features.length - 1} onClick={() => move(f.id, 1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-trough text-secondary disabled:opacity-35">
                  <ChevronDown className="h-4 w-4" />
                </button>
              </span>
            </div>
          )
        })}
        <button type="button" className="mf-row mf-row-press text-accent" onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" />
          <span className="text-[15px] font-medium">{t('feature.add')}</span>
        </button>
      </div>
      <p className="mt-2 px-1 text-xs text-secondary">{t('feature.hint')}</p>

      {editing && (
        <FeatureDialog
          key={editing === 'new' ? 'new' : editing.id}
          feature={editing === 'new' ? null : editing}
          dishes={dishes}
          today={today}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

function FeatureDialog({
  feature,
  dishes,
  today,
  onClose,
}: {
  feature: FeatureRow | null
  dishes: FeatureDishOption[]
  today: string
  onClose: () => void
}) {
  const t = useT()
  const router = useRouter()
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [dishId, setDishId] = React.useState(feature?.dishId ?? '')
  const [q, setQ] = React.useState('')
  const [title, setTitle] = React.useState(feature?.title ?? '')
  const [startDate, setStartDate] = React.useState(feature?.startDate ?? (feature ? '' : today))
  const [endDate, setEndDate] = React.useState(feature?.endDate ?? '')
  const [blob, setBlob] = React.useState<Blob | null>(null)
  const [preview, setPreview] = React.useState<string | null>(
    feature?.posterPath ? `/api/uploads/${feature.posterPath}` : null,
  )
  const [removePoster, setRemovePoster] = React.useState(false)
  const [error, setError] = React.useState('')
  const [pending, startTransition] = React.useTransition()

  const list = dishes.filter((d) => !q.trim() || d.name.includes(q.trim()))

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const c = await compressImage(f)
    setBlob(c)
    setPreview(URL.createObjectURL(c))
    setRemovePoster(false)
  }

  const save = () => {
    setError('')
    if (!dishId) return setError(t('err.pickDish'))
    const form = new FormData()
    form.set('dishId', dishId)
    form.set('title', title)
    form.set('startDate', startDate)
    form.set('endDate', endDate)
    if (blob) form.set('poster', blob, 'poster.jpg')
    if (removePoster) form.set('removePoster', '1')
    startTransition(async () => {
      const res = feature ? await updateFeature(feature.id, form) : await createFeature(form)
      if (!res.ok) return setError(res.error)
      onClose()
      router.refresh()
    })
  }

  const remove = () =>
    startTransition(async () => {
      await deleteFeature(feature!.id)
      onClose()
      router.refresh()
    })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={feature ? t('feature.editTitle') : t('feature.add')}
        className="max-h-[92dvh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-4">
          {/* 选菜 */}
          <div>
            <Label>{t('feature.dish')}</Label>
            <div className="mf-inset flex h-10 items-center gap-2 px-3">
              <Search className="h-4 w-4 text-secondary" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('menu.searchPh')}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <div className="mt-2 flex max-h-44 flex-wrap gap-2 overflow-y-auto p-0.5">
              {list.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDishId(d.id)}
                  className={cn(
                    'mf-pressable h-8 rounded-full px-3 text-[13px] font-medium',
                    d.id === dishId ? 'bg-accent-strong text-white' : 'bg-trough text-secondary',
                  )}
                >
                  {d.name}
                  {d.cookTotal > 0 && <span className="ml-1 opacity-70">{d.cookTotal}</span>}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>{t('feature.title')}</Label>
            <Input value={title} maxLength={12} placeholder={t('feature.titlePh')} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <Label>{t('feature.start')}</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="flex-1">
              <Label>{t('feature.end')}</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <p className="-mt-2 px-1 text-xs text-secondary">{t('feature.dateHint')}</p>

          {/* 海报图（可选） */}
          <div>
            <Label>{t('feature.poster')}</Label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mf-inset relative flex aspect-[2.4/1] w-full items-center justify-center overflow-hidden rounded-2xl"
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1 text-secondary">
                  <ImagePlus className="h-6 w-6" />
                  <span className="text-xs">{t('feature.posterHint')}</span>
                </span>
              )}
            </button>
            {preview && (
              <button
                type="button"
                className="mt-1.5 inline-flex items-center gap-1 text-xs text-secondary"
                onClick={() => {
                  setPreview(null)
                  setBlob(null)
                  setRemovePoster(true)
                }}
              >
                <X className="h-3.5 w-3.5" />
                {t('feature.posterRemove')}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          <Button className="w-full" size="lg" loading={pending} onClick={save}>
            {feature ? t('common.save') : t('common.add')}
          </Button>
          {feature && (
            <button
              type="button"
              className="flex w-full items-center justify-center gap-1.5 py-2 text-sm text-danger"
              onClick={remove}
            >
              <Trash2 className="h-4 w-4" />
              {t('feature.delete')}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
