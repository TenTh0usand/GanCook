'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { createSession, clearSession, getSession } from '@/lib/auth/session'
import { getCurrentUser, isSetupNeeded, getUserByName } from '@/lib/auth/user'
import { getSettings, setSetting } from '@/lib/settings'
import { seedDefaultSchedules } from '@/lib/seed'
import { getT } from '@/lib/i18n/server'

export type ActionResult = { ok: true } | { ok: false; error: string }

const isPin = (v: string) => /^\d{6}$/.test(v)

/** 6 位 PIN 轻量内存限流：同一账号连续输错 20 次冷却 5 分钟 */
const LOGIN_MAX_FAILURES = 20
const LOGIN_LOCK_MS = 5 * 60 * 1000
const LOGIN_STALE_MS = 60 * 60 * 1000

type LoginAttempt = { count: number; lockedUntil: number; lastAt: number }

const gAuth = globalThis as unknown as {
  __gancookLoginAttempts?: Map<string, LoginAttempt>
}

function getAttemptMap(): Map<string, LoginAttempt> {
  if (!gAuth.__gancookLoginAttempts) {
    gAuth.__gancookLoginAttempts = new Map()
  }
  return gAuth.__gancookLoginAttempts
}

/** 首启：创建管理员 + 家庭名 + 默认规则 */
export async function setupAdmin(input: {
  familyName: string
  name: string
  pin: string
}): Promise<ActionResult> {
  const t = await getT()
  if (!isSetupNeeded()) return { ok: false, error: t('err.alreadySetup') }

  const name = input.name.trim()
  if (!name) return { ok: false, error: t('err.nameRequired') }
  if (name.length > 12) return { ok: false, error: t('err.nameTooLong') }
  if (!isPin(input.pin)) return { ok: false, error: t('err.pin6') }

  const familyName = input.familyName.trim().slice(0, 20) || '我家'
  const passwordHash = await hashPassword(input.pin)
  const user = db.transaction(() => {
    const created = db
      .insert(users)
      .values({ name, passwordHash, isAdmin: true })
      .returning()
      .get()
    setSetting('familyName', familyName)
    setSetting('registrationOpen', '1')
    seedDefaultSchedules()
    return created
  })

  await createSession({ userId: user.id, name: user.name, isAdmin: true })
  redirect('/home')
}

/** 注册新成员 */
export async function register(input: {
  name: string
  pin: string
  joinCode?: string
}): Promise<ActionResult> {
  const t = await getT()
  if (isSetupNeeded()) redirect('/setup')

  const settings = getSettings()
  if (!settings.registrationOpen)
    return { ok: false, error: t('err.regClosed') }
  if (settings.joinCode && settings.joinCode !== (input.joinCode || '').trim())
    return { ok: false, error: t('err.badJoinCode') }

  const name = input.name.trim()
  if (!name) return { ok: false, error: t('err.nameRequired') }
  if (name.length > 12) return { ok: false, error: t('err.nameTooLong') }
  if (!isPin(input.pin)) return { ok: false, error: t('err.pin6') }
  if (getUserByName(name)) return { ok: false, error: t('err.nameTaken') }

  const passwordHash = await hashPassword(input.pin)
  const user = db
    .insert(users)
    .values({ name, passwordHash, isAdmin: false })
    .returning()
    .get()

  await createSession({ userId: user.id, name: user.name, isAdmin: false })
  revalidatePath('/login')
  revalidatePath('/admin')
  redirect('/home')
}

/** 登录 */
export async function login(input: {
  name: string
  pin: string
}): Promise<ActionResult> {
  const t = await getT()
  if (isSetupNeeded()) redirect('/setup')

  const trimmedName = input.name.trim()
  if (!trimmedName) return { ok: false, error: t('err.nameRequired') }

  const key = trimmedName.toLowerCase()
  const now = Date.now()
  const attempts = getAttemptMap()
  if (attempts.size > 500) {
    for (const [k, v] of attempts) {
      if (now - v.lastAt > LOGIN_STALE_MS && v.lockedUntil <= now) {
        attempts.delete(k)
      }
    }
  }

  const prev = attempts.get(key)
  if (prev && prev.lockedUntil > now) {
    const mins = Math.max(1, Math.ceil((prev.lockedUntil - now) / 60000))
    return { ok: false, error: t('err.loginLocked', { m: mins }) }
  }
  if (prev && prev.lockedUntil > 0 && prev.lockedUntil <= now) {
    attempts.delete(key)
  }

  const user = getUserByName(trimmedName)
  const valid = user ? await verifyPassword(input.pin, user.passwordHash) : false
  if (!user || !valid) {
    const cur = attempts.get(key)
    const nextCount = (cur ? cur.count : 0) + 1
    if (nextCount >= LOGIN_MAX_FAILURES) {
      attempts.set(key, {
        count: nextCount,
        lockedUntil: now + LOGIN_LOCK_MS,
        lastAt: now,
      })
      return { ok: false, error: t('err.loginLocked', { m: 5 }) }
    }
    attempts.set(key, { count: nextCount, lockedUntil: 0, lastAt: now })
    return { ok: false, error: t('err.badCredentials') }
  }

  attempts.delete(key)
  await createSession({
    userId: user.id,
    name: user.name,
    isAdmin: user.isAdmin,
  })
  redirect('/home')
}

export async function logout(): Promise<void> {
  await clearSession()
  redirect('/login')
}

/** 修改密码 */
export async function changePassword(input: {
  oldPin: string
  newPin: string
}): Promise<ActionResult> {
  const t = await getT()
  const session = await getSession()
  if (!session) return { ok: false, error: t('err.loginRequired') }
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }

  if (!isPin(input.newPin)) return { ok: false, error: t('err.pin6') }
  const valid = await verifyPassword(input.oldPin, me.passwordHash)
  if (!valid) return { ok: false, error: t('err.oldPinWrong') }

  const passwordHash = await hashPassword(input.newPin)
  db.update(users).set({ passwordHash }).where(eq(users.id, me.id)).run()
  return { ok: true }
}
