'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth/user'
import { getT } from '@/lib/i18n/server'
import { toggleRole } from '@/lib/duties'
import { isDutyKind, isMealType } from '@/lib/roles'
import type { ActionResult } from '@/lib/actions/meals'

const reDate = /^\d{4}-\d{2}-\d{2}$/

/**
 * 「我参与了 备菜 / 做菜 / 善后」打卡开关（GanCook-10k 扩展）。
 * 只能标记自己：userId 永远取当前登录用户，不接受客户端传入。
 */
export async function toggleMyRole(input: {
  date: string
  slot: string
  kind: string
}): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  if (!reDate.test(input.date)) return { ok: false, error: t('err.dateFmt') }
  if (!isMealType(input.slot) || !isDutyKind(input.kind))
    return { ok: false, error: t('err.badInput') }

  toggleRole({
    userId: me.id,
    date: input.date,
    slot: input.slot,
    kind: input.kind,
    source: 'manual',
  })

  revalidatePath('/me')
  revalidatePath('/stats')
  revalidatePath('/prep')
  revalidatePath('/meals', 'layout')
  revalidatePath('/home')
  return { ok: true }
}
