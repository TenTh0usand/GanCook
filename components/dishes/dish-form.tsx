'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, ImagePlus, Loader2, Trash2, Archive, ArchiveRestore, Soup, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { FileTrigger } from '@/components/ui/file-trigger'
import { useT } from '@/components/i18n-provider'
import { compressImage } from '@/lib/client/compress-image'
import {
  createDish,
  updateDish,
  deleteDish,
  setDishStatus,
} from '@/lib/actions/dishes'
import { CategoryPicker, type CategoryOption } from '@/components/dishes/category-picker'
import { DishCookSection, type CookLogItem } from '@/components/dishes/dish-cook-section'
import type { Dish } from '@/lib/db/schema'

/** GanCook-10k（P2）：菜品弹窗需要的额外信息 */
export type DishSheetExtra = {
  categories: CategoryOption[]
  meId: string
  isAdmin: boolean
  memberNames: Record<string, string>
  cook?: { total: number; last: string | null; logs: CookLogItem[] }
}

export function DishForm({
  mode,
  dish,
  children,
  canManage = true,
  extra,
}: {
  mode: 'create' | 'edit'
  dish?: Dish
  children: React.ReactNode
  /** 编辑模式下：false = 只读查看（非创建者 / 非管理员），仍可记「我做过」 */
  canManage?: boolean
  extra: DishSheetExtra
}) {
  const router = useRouter()
  const t = useT()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(dish?.name ?? '')
  const [description, setDescription] = useState(dish?.description ?? '')
  const [tags, setTags] = useState((dish?.tags ?? []).join(' '))
  const [category, setCategory] = useState<string | null>(dish?.category ?? null)
  const [subcategory, setSubcategory] = useState<string | null>(dish?.subcategory ?? null)
  const [pinned, setPinned] = useState(dish?.pinned ?? false)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(
    dish?.imagePath ? `/api/uploads/${dish.imagePath}` : null,
  )
  const [compressing, setCompressing] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const readOnly = mode === 'edit' && !canManage
  const catName = (id: string | null) => extra.categories.find((c) => c.id === id)?.name

  const onOpenChange = (next: boolean) => {
    if (next) {
      setName(dish?.name ?? '')
      setDescription(dish?.description ?? '')
      setTags((dish?.tags ?? []).join(' '))
      setCategory(dish?.category ?? null)
      setSubcategory(dish?.subcategory ?? null)
      setPinned(dish?.pinned ?? false)
      setBlob(null)
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
      setPreview(dish?.imagePath ? `/api/uploads/${dish.imagePath}` : null)
      setCompressing(false)
      setError('')
    }
    setOpen(next)
  }

  const pickFile = async (f: File | undefined) => {
    if (!f) return
    setError('')
    setCompressing(true)
    try {
      const compressed = await compressImage(f)
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
      setBlob(compressed)
      setPreview(URL.createObjectURL(compressed))
    } finally {
      setCompressing(false)
    }
  }

  const submit = () => {
    setError('')
    if (!name.trim()) return setError(t('err.dishNameRequired'))
    const form = new FormData()
    form.set('name', name)
    form.set('description', description)
    form.set('tags', tags)
    form.set('category', category ?? '')
    form.set('subcategory', subcategory ?? '')
    form.set('pinned', pinned ? '1' : '0')
    if (blob) form.set('image', blob, 'dish.jpg')
    startTransition(async () => {
      const res =
        mode === 'create'
          ? await createDish(form)
          : await updateDish(dish!.id, form)
      if (res.ok) {
        setOpen(false)
        if (mode === 'create') {
          setName('')
          setDescription('')
          setTags('')
          setCategory(null)
          setSubcategory(null)
          setPinned(false)
          setBlob(null)
          setPreview(null)
        }
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  const runStatus = (status: 'active' | 'archived') =>
    startTransition(async () => {
      const res = await setDishStatus(dish!.id, status)
      if (!res.ok) return setError(res.error)
      setOpen(false)
      router.refresh()
    })

  const runDelete = () =>
    startTransition(async () => {
      const res = await deleteDish(dish!.id)
      if (!res.ok) return setError(res.error)
      setOpen(false)
      router.refresh()
    })

  const cookSection =
    mode === 'edit' && dish && extra.cook ? (
      <DishCookSection
        dishId={dish.id}
        total={extra.cook.total}
        last={extra.cook.last}
        logs={extra.cook.logs}
        meId={extra.meId}
        isAdmin={extra.isAdmin}
        memberNames={extra.memberNames}
      />
    ) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        title={
          readOnly
            ? dish!.name
            : mode === 'create'
              ? t('dishform.addTitle')
              : t('dishform.editTitle')
        }
        className="max-h-[92dvh] overflow-y-auto"
        // 打开时不自动聚焦第一个控件（避免照片框出现黑框、手机弹出键盘）
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {readOnly ? (
          /* 只读查看：非创建者 / 非管理员 */
          <div className="space-y-4">
            <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl mf-inset">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt={dish!.name} className="h-full w-full object-cover" />
              ) : (
                <Soup className="h-9 w-9 text-accent/35" strokeWidth={1.5} />
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {catName(dish!.category) && (
                <span className="rounded-[var(--radius-chip)] bg-trough px-2.5 py-1 text-secondary">
                  {catName(dish!.category)}
                  {catName(dish!.subcategory) ? ` · ${catName(dish!.subcategory)}` : ''}
                </span>
              )}
              {dish!.pinned && (
                <span className="rounded-[var(--radius-chip)] bg-[rgb(var(--mf-accent-soft)/0.15)] px-2.5 py-1 text-accent">
                  {t('dishform.pinned')}
                </span>
              )}
              {(dish!.tags ?? []).map((tag) => (
                <span key={tag} className="rounded-[var(--radius-chip)] bg-trough px-2.5 py-1 text-secondary">
                  #{tag}
                </span>
              ))}
            </div>
            {dish!.description && <p className="text-sm text-secondary">{dish!.description}</p>}
            {cookSection}
            <p className="text-center text-xs text-secondary/70">{t('dishform.readOnlyHint')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 图片：直接覆盖透明 input + 明确拍照 / 相册按钮，避免手机 Chrome 弹窗拦截 hidden input */}
            <div>
              <FileTrigger
                accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif"
                disabled={compressing}
                ariaLabel={t('dishform.photo')}
                onFiles={(fs) => void pickFile(fs[0])}
                className="mf-pressable relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl mf-inset"
              >
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview}
                    alt="预览"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex flex-col items-center gap-1.5 text-secondary">
                    <ImagePlus className="h-7 w-7" />
                    <span className="text-sm">{t('dishform.photo')}</span>
                  </span>
                )}
                {compressing && (
                  <span className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1.5 bg-black/45 text-xs font-medium text-white">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    {t('photo.compressing')}
                  </span>
                )}
              </FileTrigger>
              <div className="mt-2 flex items-center gap-2">
                <FileTrigger
                  accept="image/*"
                  capture="environment"
                  disabled={compressing}
                  onFiles={(fs) => void pickFile(fs[0])}
                  className="mf-pressable mf-btn inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] bg-trough px-3 text-sm text-ink"
                >
                  <Camera className="h-4 w-4" />
                  {t('photo.camera')}
                </FileTrigger>
                <FileTrigger
                  accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif"
                  disabled={compressing}
                  onFiles={(fs) => void pickFile(fs[0])}
                  className="mf-pressable mf-btn inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] bg-trough px-3 text-sm text-ink"
                >
                  <ImagePlus className="h-4 w-4" />
                  {t('photo.library')}
                </FileTrigger>
                {mode === 'create' && preview && (
                  <button
                    type="button"
                    onClick={() => {
                      if (preview.startsWith('blob:')) URL.revokeObjectURL(preview)
                      setPreview(null)
                      setBlob(null)
                    }}
                    className="ml-auto inline-flex h-9 items-center gap-1 px-2 text-xs text-secondary hover:text-ink"
                  >
                    <X className="h-3.5 w-3.5" />
                    {t('common.delete')}
                  </button>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="dish-name">{t('dishform.name')}</Label>
              <Input
                id="dish-name"
                placeholder={t('dishform.namePh')}
                value={name}
                maxLength={30}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* GanCook-10k：分类 + 家常精选 */}
            <CategoryPicker
              categories={extra.categories}
              category={category}
              subcategory={subcategory}
              onChange={(c, s) => {
                setCategory(c)
                setSubcategory(s)
              }}
              labelMain={t('dishform.category')}
              labelSub={t('dishform.subcategory')}
            />
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3">
              <div>
                <p className="text-[15px] font-medium text-ink">{t('dishform.pinned')}</p>
                <p className="mt-0.5 text-xs text-secondary">{t('dishform.pinnedDesc')}</p>
              </div>
              <Switch checked={pinned} onChange={setPinned} label={t('dishform.pinned')} />
            </div>

            {cookSection}

            <div>
              <Label htmlFor="dish-desc">{t('dishform.note')}</Label>
              <Textarea
                id="dish-desc"
                placeholder={t('dishform.notePh')}
                value={description}
                maxLength={200}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dish-tags">{t('dishform.tags')}</Label>
              <Input
                id="dish-tags"
                placeholder={t('dishform.tagsPh')}
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button className="w-full" size="lg" loading={pending} disabled={compressing} onClick={submit}>
              {mode === 'create' ? t('common.add') : t('common.save')}
            </Button>

            {mode === 'edit' && (
              <div className="flex gap-2 pt-1">
                {dish!.status === 'active' ? (
                  <Button
                    variant="trough"
                    size="sm"
                    className="flex-1"
                    onClick={() => runStatus('archived')}
                  >
                    <Archive className="h-4 w-4" />
                    {t('dishform.archive')}
                  </Button>
                ) : (
                  <Button
                    variant="trough"
                    size="sm"
                    className="flex-1"
                    onClick={() => runStatus('active')}
                  >
                    <ArchiveRestore className="h-4 w-4" />
                    {t('dishform.restore')}
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  className="flex-1"
                  onClick={runDelete}
                >
                  <Trash2 className="h-4 w-4" />
                  {t('common.delete')}
                </Button>
              </div>
            )}

            <DialogClose className="sr-only">{t('common.cancel')}</DialogClose>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
