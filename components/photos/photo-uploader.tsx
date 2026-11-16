'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, ImagePlus, Loader2, RotateCw, X } from 'lucide-react'
import { useT } from '@/components/i18n-provider'
import { compressImage } from '@/lib/compress-image'
import { cn } from '@/lib/utils'

type Item = { key: string; preview: string; progress: number; status: 'compress' | 'upload' | 'error'; error?: string; file: File }

/**
 * 拍照 / 相册上传：拍照直接打开后置摄像头；相册可多选。
 * 每张图先在手机上压到 2MB 以下，再单独上传（带进度，失败可重试，不影响其它图片）。
 */
export function PhotoUploader({
  mealId,
  source,
  remaining,
  compact = false,
}: {
  mealId: string
  source: 'meal' | 'review'
  /** 还能传几张 */
  remaining: number
  compact?: boolean
}) {
  const t = useT()
  const router = useRouter()
  const camRef = useRef<HTMLInputElement>(null)
  const libRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Item[]>([])
  const [msg, setMsg] = useState('')

  const patch = (key: string, p: Partial<Item>) => setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...p } : i)))

  const upload = async (it: Item) => {
    patch(it.key, { status: 'compress', progress: 0, error: undefined })
    const blob = await compressImage(it.file)
    patch(it.key, { status: 'upload' })
    const fd = new FormData()
    fd.append('file', blob, it.file.name.replace(/\.\w+$/, '') + '.jpg')
    fd.append('source', source)
    const res = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `/api/meals/${mealId}/photos`)
      xhr.upload.onprogress = (e) => e.lengthComputable && patch(it.key, { progress: e.loaded / e.total })
      xhr.onload = () => {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          resolve({ ok: false, error: 'NETWORK' })
        }
      }
      xhr.onerror = () => resolve({ ok: false, error: 'NETWORK' })
      xhr.send(fd)
    })
    if (res.ok) {
      setItems((cur) => cur.filter((i) => i.key !== it.key))
      URL.revokeObjectURL(it.preview)
      router.refresh()
    } else {
      patch(it.key, { status: 'error', error: t(`photo.err.${res.error ?? 'NETWORK'}`) })
    }
  }

  const pick = (files: FileList | null) => {
    setMsg('')
    if (!files?.length) return
    const room = Math.max(0, remaining - items.length)
    const list = [...files].filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name))
    if (list.length > room) setMsg(t('photo.tooMany', { n: room }))
    const next = list.slice(0, room).map((file) => ({
      // crypto.randomUUID 只在 HTTPS 下可用（家里是 http 访问），这里用简单的随机 ID
      key: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      preview: URL.createObjectURL(file),
      progress: 0,
      status: 'compress' as const,
      file,
    }))
    setItems((cur) => [...cur, ...next])
    // 依次上传，避免手机同时压缩多张卡顿
    void (async () => {
      for (const it of next) await upload(it)
    })()
  }

  const disabled = remaining - items.length <= 0

  return (
    <div>
      <div className={cn('flex gap-2', compact && 'gap-1.5')}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => camRef.current?.click()}
          className="mf-pressable mf-btn flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] bg-trough px-3 text-sm text-ink disabled:opacity-40"
        >
          <Camera className="h-4 w-4" />
          {t('photo.camera')}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => libRef.current?.click()}
          className="mf-pressable mf-btn flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] bg-trough px-3 text-sm text-ink disabled:opacity-40"
        >
          <ImagePlus className="h-4 w-4" />
          {t('photo.library')}
        </button>
      </div>
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={libRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          pick(e.target.files)
          e.target.value = ''
        }}
      />
      {msg && <p className="mt-2 text-xs text-secondary">{msg}</p>}
      {items.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {items.map((it) => (
            <div key={it.key} className="relative aspect-square overflow-hidden rounded-[calc(var(--radius-field)*0.6)] bg-trough">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.preview} alt="" className="h-full w-full object-cover opacity-60" />
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]">
                {it.status === 'error' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void upload(it)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55"
                      aria-label={t('photo.retry')}
                    >
                      <RotateCw className="h-4 w-4" />
                    </button>
                    <span className="px-1 text-center leading-tight">{it.error}</span>
                  </>
                ) : (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {it.status === 'compress' ? t('photo.compressing') : `${Math.round(it.progress * 100)}%`}
                  </>
                )}
              </span>
              {it.status === 'error' && (
                <button
                  type="button"
                  onClick={() => setItems((cur) => cur.filter((i) => i.key !== it.key))}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white"
                  aria-label={t('common.delete')}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
