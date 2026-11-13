'use client'

import { useRef, useState } from 'react'
import { Download, Upload, FileJson, ChefHat, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { List, Row } from '@/components/ui/list'
import { IconChip } from '@/components/ui/icon-chip'
import { useT } from '@/components/i18n-provider'

type Preview = {
  file: File
  kind: 'full' | 'dishes'
  exportedAt: string
  appVersion: string
  dishes: number
  members: number
  meals: number
  images: number
}

type Summary = { kind: 'full' | 'dishes'; rows: number; files: number; added?: number; skipped?: number }

/** 家庭管理 · 数据导入导出 */
export function DataTransfer() {
  const t = useT()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null)

  const pick = async (file: File | undefined) => {
    setMsg(null)
    setPreview(null)
    if (!file) return
    try {
      const b = JSON.parse(await file.text())
      if (b?.format !== 'gancook-backup' || (b.kind !== 'full' && b.kind !== 'dishes')) throw new Error()
      const count = (k: string) => (Array.isArray(b.tables?.[k]) ? b.tables[k].length : 0)
      setPreview({
        file,
        kind: b.kind,
        exportedAt: String(b.exportedAt ?? '').replace('T', ' ').slice(0, 16),
        appVersion: String(b.appVersion ?? '?'),
        dishes: count('dishes'),
        members: count('users'),
        meals: count('meals'),
        images: Object.keys(b.files ?? {}).length,
      })
    } catch {
      setMsg({ text: t('data.err.BAD_FORMAT'), err: true })
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const runImport = async () => {
    if (!preview) return
    if (preview.kind === 'full' && !confirm(t('data.confirmFull'))) return
    setBusy(true)
    setMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', preview.file)
      const res = await fetch('/api/admin/import', { method: 'POST', body: fd })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; summary?: Summary }
      if (!json.ok || !json.summary) {
        setMsg({ text: t(`data.err.${json.error ?? 'IMPORT_FAILED'}`), err: true })
        return
      }
      const s = json.summary
      setPreview(null)
      if (s.kind === 'full') {
        setMsg({ text: t('data.doneFull', { n: s.rows, f: s.files }) })
        setTimeout(() => window.location.reload(), 1200)
      } else {
        setMsg({ text: t('data.doneDishes', { a: s.added ?? 0, s: s.skipped ?? 0 }) })
        setTimeout(() => window.location.reload(), 1200)
      }
    } catch {
      setMsg({ text: t('data.err.IMPORT_FAILED'), err: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <List>
        <Row
          leading={
            <IconChip>
              <Database />
            </IconChip>
          }
          title={t('data.exportFull')}
          subtitle={t('data.exportFullDesc')}
          trailing={
            <Button asChild variant="secondary" size="sm">
              <a href="/api/admin/export?kind=full" download>
                <Download className="h-4 w-4" />
                {t('data.export')}
              </a>
            </Button>
          }
        />
        <Row
          leading={
            <IconChip>
              <ChefHat />
            </IconChip>
          }
          title={t('data.exportDishes')}
          subtitle={t('data.exportDishesDesc')}
          trailing={
            <Button asChild variant="secondary" size="sm">
              <a href="/api/admin/export?kind=dishes" download>
                <Download className="h-4 w-4" />
                {t('data.export')}
              </a>
            </Button>
          }
        />
      </List>

      <div className="mf-raised p-4">
        <div className="flex items-center gap-3">
          <IconChip>
            <Upload />
          </IconChip>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium text-ink">{t('data.import')}</p>
            <p className="mt-0.5 text-xs text-secondary">{t('data.importDesc')}</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
            <FileJson className="h-4 w-4" />
            {t('data.choose')}
          </Button>
        </div>

        {preview && (
          <div className="mf-enter mt-4 rounded-[var(--radius-field)] bg-trough p-3.5 text-sm">
            <p className="font-semibold text-ink">
              {preview.kind === 'full' ? t('data.kindFull') : t('data.kindDishes')}
              <span className="ml-2 font-normal text-secondary">
                {preview.exportedAt} · {preview.appVersion}
              </span>
            </p>
            <p className="mt-1 text-secondary">
              {preview.kind === 'full'
                ? t('data.previewFull', { m: preview.members, d: preview.dishes, l: preview.meals, f: preview.images })
                : t('data.previewDishes', { d: preview.dishes, f: preview.images })}
            </p>
            <p className={preview.kind === 'full' ? 'mt-2 text-danger' : 'mt-2 text-secondary'}>
              {preview.kind === 'full' ? t('data.warnFull') : t('data.hintDishes')}
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant={preview.kind === 'full' ? 'danger' : 'primary'}
                loading={busy}
                onClick={() => void runImport()}
              >
                {preview.kind === 'full' ? t('data.doRestore') : t('data.doMerge')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPreview(null)} disabled={busy}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        )}

        {msg && <p className={`mt-3 text-sm ${msg.err ? 'text-danger' : 'text-accent'}`}>{msg.text}</p>}
      </div>
    </div>
  )
}
