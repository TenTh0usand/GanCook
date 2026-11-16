'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth/user'
import { getT } from '@/lib/i18n/server'
import { normalizeS3, saveStorageSettings, savedSecret, testS3, type TestStep } from '@/lib/storage'
import type { S3Config } from '@/lib/storage-types'

type Input = { driver: 'local' | 's3'; s3: S3Config; secret?: string }

async function admin() {
  const me = await getCurrentUser()
  return me?.isAdmin ? me : null
}

/** 测试 S3 / R2 连接（Secret 没重新填就用已保存的） */
export async function testStorage(input: Input): Promise<{ ok: true } | { ok: false; step: TestStep | 'auth'; detail: string }> {
  if (!(await admin())) return { ok: false, step: 'auth', detail: '' }
  return testS3(normalizeS3(input.s3), input.secret?.trim() || savedSecret())
}

/** 保存存储配置；切到 S3 前先自动测一次，失败就不保存（避免之后上传全部失败） */
export async function saveStorage(input: Input): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = await getT()
  if (!(await admin())) return { ok: false, error: t('err.adminRequired') }
  const driver = input.driver === 's3' ? 's3' : 'local'
  const secret = input.secret?.trim() || ''
  if (driver === 's3') {
    const r = await testS3(normalizeS3(input.s3), secret || savedSecret())
    if (!r.ok) return { ok: false, error: t(`storage.fail.${r.step}`) + (r.detail ? `（${r.detail}）` : '') }
  }
  saveStorageSettings(driver, input.s3, secret || undefined)
  revalidatePath('/admin')
  return { ok: true }
}
