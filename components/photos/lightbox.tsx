'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react'
import { useT } from '@/components/i18n-provider'

export type LightboxPhoto = { id: string; path: string; thumbPath: string; caption?: string; canDelete?: boolean }

/** 全屏看大图：左右滑动 / 箭头切换，点一下放大到原尺寸（可拖动查看），右上角删除（有权限时） */
export function Lightbox({
  photos,
  index,
  onIndex,
  onClose,
  onDelete,
}: {
  photos: LightboxPhoto[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
  onDelete?: (id: string) => void
}) {
  const t = useT()
  const [zoom, setZoom] = useState(false)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const p = photos[index]
  const go = (d: number) => {
    setZoom(false)
    onIndex((index + d + photos.length) % photos.length)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  if (!p) return null
  return createPortal(
    <div className="mf-overlay fixed inset-0 z-[60] flex flex-col text-white" style={{ background: 'rgb(0 0 0 / 0.96)' }} data-state="open" role="dialog">
      <div className="flex items-center justify-between px-3 pt-[calc(env(safe-area-inset-top)+8px)] pb-2 text-sm">
        <span className="opacity-80">
          {index + 1} / {photos.length}
          {p.caption && <span className="ml-2">{p.caption}</span>}
        </span>
        <span className="flex items-center gap-1">
          {p.canDelete && onDelete && (
            <button
              type="button"
              aria-label={t('common.delete')}
              onClick={() => confirm(t('photo.deleteConfirm')) && onDelete(p.id)}
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            aria-label={t('photo.close')}
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
          >
            <X className="h-6 w-6" />
          </button>
        </span>
      </div>
      <div
        className={zoom ? 'flex-1 overflow-auto' : 'relative flex flex-1 items-center justify-center overflow-hidden'}
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          if (zoom || !touch.current) return
          const dx = e.changedTouches[0].clientX - touch.current.x
          const dy = e.changedTouches[0].clientY - touch.current.y
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1)
          else if (dy > 90) onClose()
          touch.current = null
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={p.id}
          src={`/api/uploads/${p.path}`}
          alt=""
          onClick={() => setZoom((z) => !z)}
          className={
            zoom
              ? 'max-w-none cursor-zoom-out'
              : 'mf-enter max-h-full max-w-full cursor-zoom-in object-contain'
          }
          style={zoom ? undefined : { backgroundImage: `url(/api/uploads/${p.thumbPath})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }}
        />
        {photos.length > 1 && !zoom && (
          <>
            <button
              type="button"
              aria-label={t('photo.prev')}
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 sm:flex"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              aria-label={t('photo.next')}
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 sm:flex"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>
      <p className="pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2 text-center text-xs opacity-60">{t('photo.lightboxHint')}</p>
    </div>,
    document.body,
  )
}
