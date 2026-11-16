'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/components/i18n-provider'
import { deletePhoto } from '@/lib/actions/photos'
import { Lightbox } from '@/components/photos/lightbox'

export type ThumbPhoto = { id: string; path: string; thumbPath: string }

/** 评价下面的一排小缩略图，点开看大图（自己的可以删除） */
export function ReviewPhotos({ photos, canDelete = false }: { photos: ThumbPhoto[]; canDelete?: boolean }) {
  const t = useT()
  const router = useRouter()
  const [open, setOpen] = useState<number | null>(null)
  const [, startTransition] = useTransition()
  if (photos.length === 0) return null
  return (
    <>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            aria-label={t('photo.view')}
            onClick={() => setOpen(i)}
            className="mf-pressable h-16 w-16 overflow-hidden rounded-[calc(var(--radius-field)*0.5)] bg-trough"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/uploads/${p.thumbPath}`} alt="" loading="lazy" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      {open != null && (
        <Lightbox
          photos={photos.map((p) => ({ ...p, canDelete }))}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          onDelete={(id) =>
            startTransition(async () => {
              await deletePhoto(id)
              setOpen(null)
              router.refresh()
            })
          }
        />
      )}
    </>
  )
}
