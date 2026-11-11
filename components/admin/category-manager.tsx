'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/i18n-provider'
import {
  createCategory,
  deleteCategory,
  moveCategory,
  updateCategory,
} from '@/lib/actions/menu-admin'

export type CategoryRow = {
  id: string
  name: string
  parentId: string | null
  badge: string | null
}

const OTHER = 'other'

/**
 * 分类管理（GanCook-10k · P2 第 4 步）：大类 / 细类的增删改、排序、角标。
 * 删除分类不会删菜：用到的菜自动归入「其他」或清空细类。
 */
export function CategoryManager({
  categories,
  counts,
}: {
  categories: CategoryRow[]
  /** 分类 id → 使用中的菜数 */
  counts: Record<string, number>
}) {
  const t = useT()
  const router = useRouter()
  const [editing, setEditing] = React.useState<string | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState('')

  const parents = categories.filter((c) => !c.parentId)
  const subsOf = (id: string) => categories.filter((c) => c.parentId === id)
  const movable = parents.filter((c) => c.id !== OTHER)

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    startTransition(async () => {
      setError('')
      const res = await fn()
      if (!res.ok) setError(res.error ?? '')
      else {
        after?.()
        router.refresh()
      }
    })

  const current = categories.find((c) => c.id === editing) ?? null

  return (
    <>
      <div className="mf-list">
        {parents.map((p) => {
          const idx = movable.findIndex((c) => c.id === p.id)
          const subs = subsOf(p.id)
          return (
            <div key={p.id} className="mf-row">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => setEditing(p.id)}
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-[15px] font-medium text-ink">{p.name}</span>
                  {p.badge && (
                    <span className="rounded-full bg-accent-strong px-1.5 py-[1px] text-[10px] font-semibold text-white">
                      {p.badge}
                    </span>
                  )}
                  <span className="text-xs text-secondary">{t('catmgr.dishN', { n: counts[p.id] ?? 0 })}</span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-secondary">
                  {subs.length > 0 ? subs.map((s) => s.name).join(' · ') : t('catmgr.noSubs')}
                </span>
              </button>
              {p.id !== OTHER && (
                <span className="flex shrink-0 gap-1">
                  <IconBtn disabled={pending || idx <= 0} onClick={() => run(() => moveCategory(p.id, -1))} label={t('catmgr.up')}>
                    <ChevronUp className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn
                    disabled={pending || idx >= movable.length - 1}
                    onClick={() => run(() => moveCategory(p.id, 1))}
                    label={t('catmgr.down')}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </IconBtn>
                </span>
              )}
            </div>
          )
        })}
        <button type="button" className="mf-row mf-row-press text-accent" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" />
          <span className="text-[15px] font-medium">{t('catmgr.addMain')}</span>
        </button>
      </div>
      <p className="mt-2 px-1 text-xs text-secondary">{t('catmgr.hint')}</p>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {/* 新增大类 */}
      {adding && (
        <NameDialog
          title={t('catmgr.addMain')}
          placeholder={t('catmgr.namePh')}
          pending={pending}
          onClose={() => setAdding(false)}
          onSubmit={(name) => run(() => createCategory({ name, parentId: null }), () => setAdding(false))}
        />
      )}

      {/* 编辑大类（含细类管理） */}
      {current && (
        <ParentEditor
          key={current.id}
          cat={current}
          subs={subsOf(current.id)}
          counts={counts}
          pending={pending}
          onClose={() => setEditing(null)}
          run={run}
        />
      )}
    </>
  )
}

function ParentEditor({
  cat,
  subs,
  counts,
  pending,
  onClose,
  run,
}: {
  cat: CategoryRow
  subs: CategoryRow[]
  counts: Record<string, number>
  pending: boolean
  onClose: () => void
  run: (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => void
}) {
  const t = useT()
  const [name, setName] = React.useState(cat.name)
  const [badge, setBadge] = React.useState(cat.badge ?? '')
  const [newSub, setNewSub] = React.useState('')

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={t('catmgr.editTitle', { name: cat.name })}
        className="max-h-[92dvh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <Label>{t('catmgr.name')}</Label>
              <Input value={name} maxLength={10} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="w-[42%]">
              <Label>{t('catmgr.badge')}</Label>
              <Input
                value={badge}
                maxLength={6}
                placeholder={t('catmgr.badgePh')}
                onChange={(e) => setBadge(e.target.value)}
              />
            </div>
          </div>
          <Button
            className="w-full"
            loading={pending}
            onClick={() => run(() => updateCategory(cat.id, { name, badge }), onClose)}
          >
            {t('common.save')}
          </Button>

          {/* 细类 */}
          <div>
            <p className="mb-2 pl-1 text-sm font-medium text-secondary">{t('catmgr.subs')}</p>
            <div className="mf-list">
              {subs.map((s, i) => (
                <SubRow
                  key={s.id}
                  sub={s}
                  count={counts[s.id] ?? 0}
                  first={i === 0}
                  last={i === subs.length - 1}
                  pending={pending}
                  run={run}
                />
              ))}
              <div className="mf-row gap-2">
                <Input
                  value={newSub}
                  maxLength={10}
                  placeholder={t('catmgr.addSubPh')}
                  onChange={(e) => setNewSub(e.target.value)}
                  className="h-9 flex-1"
                />
                <Button
                  size="sm"
                  variant="tonal"
                  disabled={!newSub.trim() || pending}
                  onClick={() => run(() => createCategory({ name: newSub, parentId: cat.id }), () => setNewSub(''))}
                >
                  <Plus className="h-4 w-4" />
                  {t('common.add')}
                </Button>
              </div>
            </div>
          </div>

          {cat.id !== OTHER && (
            <button
              type="button"
              className="flex w-full items-center justify-center gap-1.5 py-2 text-sm text-danger"
              onClick={() => {
                if (confirm(t('catmgr.deleteConfirm', { name: cat.name, n: counts[cat.id] ?? 0 })))
                  run(() => deleteCategory(cat.id), onClose)
              }}
            >
              <Trash2 className="h-4 w-4" />
              {t('catmgr.deleteMain')}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** 细类一行：名字失焦即保存，可上下移、删除 */
function SubRow({
  sub,
  count,
  first,
  last,
  pending,
  run,
}: {
  sub: CategoryRow
  count: number
  first: boolean
  last: boolean
  pending: boolean
  run: (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => void
}) {
  const t = useT()
  const [name, setName] = React.useState(sub.name)
  return (
    <div className="mf-row gap-2">
      <Input
        value={name}
        maxLength={10}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name.trim() && name.trim() !== sub.name) run(() => updateCategory(sub.id, { name, badge: sub.badge ?? '' }))
        }}
        className="h-9 flex-1"
      />
      <span className="shrink-0 text-xs text-secondary">{count}</span>
      <IconBtn disabled={pending || first} onClick={() => run(() => moveCategory(sub.id, -1))} label={t('catmgr.up')}>
        <ChevronUp className="h-4 w-4" />
      </IconBtn>
      <IconBtn disabled={pending || last} onClick={() => run(() => moveCategory(sub.id, 1))} label={t('catmgr.down')}>
        <ChevronDown className="h-4 w-4" />
      </IconBtn>
      <IconBtn
        disabled={pending}
        onClick={() => {
          if (confirm(t('catmgr.deleteSubConfirm', { name: sub.name, n: count }))) run(() => deleteCategory(sub.id))
        }}
        label={t('common.delete')}
        danger
      >
        <Trash2 className="h-4 w-4" />
      </IconBtn>
    </div>
  )
}

function IconBtn({
  children,
  onClick,
  disabled,
  label,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  label: string
  danger?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-full bg-trough disabled:opacity-35 ${
        danger ? 'text-danger' : 'text-secondary'
      }`}
    >
      {children}
    </button>
  )
}

function NameDialog({
  title,
  placeholder,
  pending,
  onClose,
  onSubmit,
}: {
  title: string
  placeholder: string
  pending: boolean
  onClose: () => void
  onSubmit: (name: string) => void
}) {
  const t = useT()
  const [name, setName] = React.useState('')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={title}>
        <div className="space-y-4">
          <Input value={name} maxLength={10} placeholder={placeholder} onChange={(e) => setName(e.target.value)} />
          <Button className="w-full" loading={pending} disabled={!name.trim()} onClick={() => onSubmit(name)}>
            {t('common.add')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
