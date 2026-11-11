import { NextResponse } from 'next/server'
import { tick } from '@/lib/scheduler'
import { CRON_SECRET } from '@/lib/env'
import { getCurrentUser } from '@/lib/auth/user'

/**
 * 手动触发调度心跳。
 * - 若配置了 CRON_SECRET：必须带 ?secret=... 或 Authorization: Bearer ...
 * - 若未配置 CRON_SECRET（如本地开发）：仅允许已登录的管理员调用
 */
export async function GET(req: Request) {
  if (CRON_SECRET) {
    const url = new URL(req.url)
    const provided =
      url.searchParams.get('secret') ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (provided !== CRON_SECRET) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  } else {
    const me = await getCurrentUser()
    if (!me?.isAdmin) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }
  const result = tick()
  return NextResponse.json({ ok: true, ...result })
}
