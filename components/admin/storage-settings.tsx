'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Cloud, HardDrive, XCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { useT } from '@/components/i18n-provider'
import { saveStorage, testStorage } from '@/lib/actions/storage'
import type { S3Config, StorageProvider } from '@/lib/storage-types'

/** 家庭管理 · 图片存储：本机 / S3·R2（R2 只需 Account ID + 桶 + 密钥） */
export function StorageSettings({
  driver: initialDriver,
  s3: initial,
  hasSecret,
  secretTail,
}: {
  driver: 'local' | 's3'
  s3: S3Config
  hasSecret: boolean
  secretTail: string
}) {
  const t = useT()
  const router = useRouter()
  const [driver, setDriver] = useState(initialDriver)
  const [c, setC] = useState<S3Config>(initial)
  const [secret, setSecret] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [testing, startTest] = useTransition()
  const [saving, startSave] = useTransition()
  const set = (k: keyof S3Config) => (e: React.ChangeEvent<HTMLInputElement>) => setC((cur) => ({ ...cur, [k]: e.target.value }))
  const isR2 = c.provider === 'r2'
  const endpointPreview = isR2 ? (c.accountId.trim() ? `https://${c.accountId.trim()}.r2.cloudflarestorage.com` : '') : c.endpoint

  const test = () =>
    startTest(async () => {
      setMsg(null)
      const r = await testStorage({ driver: 's3', s3: c, secret })
      setMsg(
        r.ok
          ? { ok: true, text: t('storage.testOk') }
          : { ok: false, text: t(`storage.fail.${r.step}`) + (r.detail ? `（${r.detail}）` : '') },
      )
    })

  const save = () =>
    startSave(async () => {
      setMsg(null)
      const r = await saveStorage({ driver, s3: c, secret })
      setMsg(r.ok ? { ok: true, text: t('common.saved') } : { ok: false, text: r.error })
      if (r.ok) {
        setSecret('')
        router.refresh()
      }
    })

  return (
    <div className="mf-raised space-y-4 p-4">
      <Segmented<'local' | 's3'>
        value={driver}
        onChange={setDriver}
        layoutId="storage-driver"
        options={[
          {
            value: 'local',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <HardDrive className="h-4 w-4" />
                {t('storage.local')}
              </span>
            ),
          },
          {
            value: 's3',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Cloud className="h-4 w-4" />
                S3 / R2
              </span>
            ),
          },
        ]}
      />
      <p className="text-xs text-secondary">{driver === 'local' ? t('storage.localDesc') : t('storage.s3Desc')}</p>

      {driver === 's3' && (
        <div className="space-y-3">
          <div>
            <Label>{t('storage.provider')}</Label>
            <Segmented<StorageProvider>
              value={c.provider}
              onChange={(provider) => setC((cur) => ({ ...cur, provider }))}
              layoutId="storage-provider"
              options={[
                { value: 'r2', label: 'Cloudflare R2' },
                { value: 's3', label: t('storage.otherS3') },
              ]}
            />
          </div>
          {isR2 ? (
            <div>
              <Label htmlFor="st-account">Account ID</Label>
              <Input id="st-account" value={c.accountId} onChange={set('accountId')} placeholder={t('storage.accountPh')} autoComplete="off" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label htmlFor="st-endpoint">Endpoint</Label>
                <Input id="st-endpoint" value={c.endpoint} onChange={set('endpoint')} placeholder="https://s3.example.com" />
              </div>
              <div>
                <Label htmlFor="st-region">Region</Label>
                <Input id="st-region" value={c.region} onChange={set('region')} placeholder="us-east-1" />
              </div>
            </div>
          )}
          {endpointPreview && <p className="-mt-1 break-all text-[11px] text-secondary">{endpointPreview}{isR2 && ' · region auto'}</p>}
          <div>
            <Label htmlFor="st-bucket">{t('storage.bucket')}</Label>
            <Input id="st-bucket" value={c.bucket} onChange={set('bucket')} placeholder="gancook" autoComplete="off" />
          </div>
          <div>
            <Label htmlFor="st-ak">Access Key ID</Label>
            <Input id="st-ak" value={c.accessKeyId} onChange={set('accessKeyId')} autoComplete="off" />
          </div>
          <div>
            <Label htmlFor="st-sk">Secret Access Key</Label>
            <Input
              id="st-sk"
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={hasSecret ? t('storage.secretSaved', { tail: secretTail }) : ''}
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="st-public">{t('storage.publicBase')}</Label>
            <Input id="st-public" value={c.publicBase} onChange={set('publicBase')} placeholder="img.example.com / xxx.r2.dev" autoComplete="off" />
            <p className="mt-1 text-[11px] text-secondary">{t('storage.publicHint')}</p>
          </div>
          <div>
            <Label htmlFor="st-prefix">{t('storage.prefix')}</Label>
            <Input id="st-prefix" value={c.prefix} onChange={set('prefix')} placeholder="gancook/" autoComplete="off" />
          </div>
          {isR2 && <p className="text-[11px] leading-relaxed text-secondary">{t('storage.r2Help')}</p>}
        </div>
      )}

      {msg && (
        <p className={`flex items-start gap-1.5 text-sm ${msg.ok ? 'text-accent' : 'text-danger'}`}>
          {msg.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span className="break-all">{msg.text}</span>
        </p>
      )}
      <div className="flex gap-2">
        {driver === 's3' && (
          <Button variant="secondary" size="sm" loading={testing} onClick={test}>
            {t('storage.test')}
          </Button>
        )}
        <Button size="sm" loading={saving} onClick={save}>
          {t('common.save')}
        </Button>
      </div>
      <p className="text-[11px] text-secondary">{t('storage.note')}</p>
    </div>
  )
}
