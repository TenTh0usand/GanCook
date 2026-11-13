'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, Plus, Trash2, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { useT } from '@/components/i18n-provider'
import { compressImage } from '@/lib/client/compress-image'
import { cn } from '@/lib/utils'
import { deletePrepLog, savePrepLog } from '@/lib/actions/prep'
import { MEAL_TYPES, type MealType } from '@/lib/roles'

type Source = 'bought' | 'fridge' | 'other'
type Row = { key: number; name: string; source: Source; qty: string; price: string }

export type PrepLogInput = {
  id: string
  date: string
  slot: MealType
  note: string | null
  imagePath: string | null
  items: { name: string; source: Source; qty: string | null; priceCents: number | null }[]
}

let keySeq = 1
const emptyRow = (): Row => ({ key: keySeq++, name: '', source: 'bought', qty: '', price: '' })

/**
 * 「记一笔」备菜表单（GanCook-10k · P4）。只有食材名称必填。
 * - 餐次默认按当前时间
 * - 每样食材：来源（买的 / 冰箱 / 其他）+ 名称 + 数量（自由文字）+ 价格（可不填）
 * - 处理方式、照片可选
 */
export function PrepForm({
  children,
  date,
  defaultSlot,
  log,
  suggestions,
}: {
  children: React.ReactNode
  date: string
  defaultSlot: MealType
  log?: PrepLogInput
  suggestions: string[]
}) {
  const t = useT()
  const router = useRouter()
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [open, setOpen] = React.useState(false)
  const init = React.useCallback(
    () => ({
      slot: log?.slot ?? defaultSlot,
      rows:
        log && log.items.length > 0
          ? log.items.map((i) => ({
              key: keySeq++,
              name: i.name,
              source: i.source,
              qty: i.qty ?? '',
              price: i.priceCents != null ? String(i.priceCents / 100) : '',
            }))
          : [emptyRow(), emptyRow()],
      note: log?.note ?? '',
      preview: log?.imagePath ? `/api/uploads/${log.imagePath}` : null,
    }),
    [log, defaultSlot],
  )
  const [slot, setSlot] = React.useState<MealType>(init().slot)
  const [rows, setRows] = React.useState<Row[]>(init().rows)
  const [note, setNote] = React.useState(init().note)
  const [blob, setBlob] = React.useState<Blob | null>(null)
  const [preview, setPreview] = React.useState<string | null>(init().preview)
  const [removeImage, setRemoveImage] = React.useState(false)
  const [error, setError] = React.useState('')
  const [pending, startTransition] = React.useTransition()

  // 每次打开都从最新数据重新初始化
  const onOpenChange = (o: boolean) => {
    if (o) {
      const v = init()
      setSlot(v.slot)
      setRows(v.rows)
      setNote(v.note)
      setPreview(v.preview)
      setBlob(null)
      setRemoveImage(false)
      setError('')
    }
    setOpen(o)
  }

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const totalCents = rows.reduce((a, r) => {
    const v = Number(r.price.replace(/[¥￥元\s,，]/g, ''))
    return a + (r.name.trim() && Number.isFinite(v) && v > 0 ? Math.round(v * 100) : 0)
  }, 0)
  const fmtCents = (cents: number) =>
    cents % 100 === 0
      ? String(cents / 100)
      : cents % 10 === 0
        ? (cents / 100).toFixed(1)
        : (cents / 100).toFixed(2)

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const c = await compressImage(f)
    setBlob(c)
    setPreview(URL.createObjectURL(c))
    setRemoveImage(false)
  }

  const save = () => {
    setError('')
    const items = rows
      .filter((r) => r.name.trim())
      .map((r) => ({ name: r.name, source: r.source, qty: r.qty, price: r.price }))
    if (items.length === 0) return setError(t('err.prepNeedItem'))
    const form = new FormData()
    if (log) form.set('id', log.id)
    form.set('date', log?.date ?? date)
    form.set('slot', slot)
    form.set('note', note)
    form.set('items', JSON.stringify(items))
    if (blob) form.set('image', blob, 'prep.jpg')
    if (removeImage) form.set('removeImage', '1')
    startTransition(async () => {
      const res = await savePrepLog(form)
      if (!res.ok) return setError(res.error)
      setOpen(false)
      router.refresh()
    })
  }

  const remove = () => {
    if (!log || !confirm(t('prep.deleteConfirm'))) return
    startTransition(async () => {
      await deletePrepLog(log.id)
      setOpen(false)
      router.refresh()
    })
  }

  const sourceLabel: Record<Source, string> = {
    bought: t('prep.src.bought'),
    fridge: t('prep.src.fridge'),
    other: t('prep.src.other'),
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        title={log ? t('prep.editTitle') : t('prep.addTitle')}
        className="max-h-[92dvh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <datalist id="prep-item-names">
          {suggestions.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <div className="space-y-4">
          <div>
            <Label>{t('create.mealType')}</Label>
            <Segmented<MealType>
              value={slot}
              onChange={setSlot}
              layoutId="prep-slot"
              className="[&_button]:px-1"
              options={MEAL_TYPES.map((m) => ({ value: m, label: t('meal.' + m) }))}
            />
          </div>

          {/* 食材列表 */}
          <div>
            <Label>{t('prep.items')}</Label>
            <div className="space-y-2.5">
              {rows.map((r, i) => (
                <div key={r.key} className="rounded-2xl bg-surface p-2.5">
                  <div className="flex items-center gap-1.5">
                    {(['bought', 'fridge', 'other'] as Source[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => update(r.key, { source: s })}
                        className={cn(
                          'h-7 rounded-[var(--radius-chip)] px-2.5 text-xs font-semibold transition-colors',
                          r.source === s
                            ? s === 'bought'
                              ? 'bg-[rgb(var(--mf-role-prep-soft)/0.18)] text-[var(--mf-role-prep)]'
                              : 'bg-trough text-ink'
                            : 'text-secondary/70',
                        )}
                      >
                        {sourceLabel[s]}
                      </button>
                    ))}
                    {rows.length > 1 && (
                      <button
                        type="button"
                        aria-label={t('common.delete')}
                        className="ml-auto p-1 text-secondary/60"
                        onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Input
                      list="prep-item-names"
                      value={r.name}
                      maxLength={30}
                      placeholder={i === 0 ? t('prep.namePh') : t('prep.namePh2')}
                      onChange={(e) => update(r.key, { name: e.target.value })}
                      className="h-10 min-w-0 flex-[2]"
                    />
                    <Input
                      value={r.qty}
                      maxLength={20}
                      placeholder={t('prep.qtyPh')}
                      onChange={(e) => update(r.key, { qty: e.target.value })}
                      className="h-10 min-w-0 flex-1"
                    />
                    <Input
                      value={r.price}
                      inputMode="decimal"
                      placeholder="¥"
                      onChange={(e) => update(r.key, { price: e.target.value })}
                      className="h-10 w-[72px] shrink-0"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-sm font-medium text-accent"
                onClick={() => setRows((rs) => [...rs, emptyRow()])}
              >
                <Plus className="h-4 w-4" />
                {t('prep.addItem')}
              </button>
              {totalCents > 0 && (
                <span className="text-sm font-semibold text-[var(--mf-role-prep)]">
                  {t('prep.total', { n: fmtCents(totalCents) })}
                </span>
              )}
            </div>
          </div>

          <div>
            <Label>{t('prep.note')}</Label>
            <Textarea
              value={note}
              maxLength={300}
              placeholder={t('prep.notePh')}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div>
            <Label>{t('prep.photo')}</Label>
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
                  <span className="text-xs">{t('prep.photoHint')}</span>
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
                  setRemoveImage(true)
                }}
              >
                <X className="h-3.5 w-3.5" />
                {t('prep.photoRemove')}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          <Button className="w-full" size="lg" loading={pending} onClick={save}>
            {log ? t('common.save') : t('prep.submit')}
          </Button>
          {log && (
            <button
              type="button"
              className="flex w-full items-center justify-center gap-1.5 py-2 text-sm text-danger"
              onClick={remove}
            >
              <Trash2 className="h-4 w-4" />
              {t('prep.delete')}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
