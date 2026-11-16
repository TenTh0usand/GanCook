'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Images } from 'lucide-react'
import { useT } from '@/components/i18n-provider'
import { deletePhoto } from '@/lib/actions/photos'
import { PhotoUploader } from '@/components/photos/photo-uploader'
import { Lightbox, type LightboxPhoto } from '@/components/photos/lightbox'

export type WallPhoto = { id: string; path: string; thumbPath: string; userId: string | null; userName: string | null }

/**
 * 「这顿的照片」：三列缩略图 + 拍照 / 相册上传 + 全屏看大图。
 * 有人在这里传过图就只显示这些；一张都没有时用评价里的图片代替（fromReviews=true）。
 */
export function MealPhotos({
  mealId,
  photos,
  fromReviews,
  remaining,
  meId,
  isAdmin,
}: {
  mealId: string
  photos: WallPhoto[]
  fromReviews: boolean
  remaining: number
  meId: string
  isAdmin: boolean
}) {
  const t = useT()
  const router = useRouter()
  const [open, setOpen] = useState<number | null>(null)
  const [, startTransition] = useTransition()

  const list: LightboxPhoto[] = photos.map((p) => ({
    id: p.id,
    path: p.path,
    thumbPath: p.thumbPath,
    caption: p.userName ?? undefined,
    canDelete: p.userId === meId || isAdmin,
  }))

  const remove = (id: string) =>
    startTransition(async () => {
      await deletePhoto(id)
      setOpen(null)
      router.refresh()
    })

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">
          {t('photo.title')}
          {photos.length > 0 && <span className="ml-2 text-sm font-normal text-secondary">{t('photo.count', { n: photos.length })}</span>}
        </h2>
        <PhotoUploader mealId={mealId} source="meal" remaining={remaining} compact />
      </div>
      {photos.length === 0 ? (
        <div className="mf-inset flex items-center justify-center gap-2 p-5 text-sm text-secondary">
          <Images className="h-4 w-4" />
          {t('photo.empty')}
        </div>
      ) : (
        <>
          {fromReviews && <p className="mb-2 text-xs text-secondary">{t('photo.fromReviews')}</p>}
          <div className="grid grid-cols-3 gap-1.5">
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setOpen(i)}
                className="mf-pressable relative aspect-square overflow-hidden rounded-[calc(var(--radius-field)*0.6)] bg-trough"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/uploads/${p.thumbPath}`} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </>
      )}
      {open != null && <Lightbox photos={list} index={open} onIndex={setOpen} onClose={() => setOpen(null)} onDelete={remove} />}
    </section>
  )
}
