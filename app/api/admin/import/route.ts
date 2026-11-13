import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth/user'
import { importBackup, parseBackup } from '@/lib/backup'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_BYTES = 100 * 1024 * 1024

/** POST /api/admin/import（multipart: file）—— 导入备份（仅管理员） */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user?.isAdmin) return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 })

  let raw: unknown
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: 'NO_FILE' }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: 'TOO_LARGE' }, { status: 413 })
    raw = JSON.parse(await file.text())
  } catch {
    return NextResponse.json({ ok: false, error: 'BAD_FORMAT' }, { status: 400 })
  }

  const backup = parseBackup(raw)
  if (typeof backup === 'string') return NextResponse.json({ ok: false, error: backup }, { status: 400 })

  try {
    const summary = await importBackup(backup, user.id)
    revalidatePath('/', 'layout')
    return NextResponse.json({ ok: true, summary })
  } catch (err) {
    console.error('[import] failed', err)
    const code = (err as Error)?.message === 'FK_CHECK_FAILED' ? 'FK_CHECK_FAILED' : 'IMPORT_FAILED'
    return NextResponse.json({ ok: false, error: code }, { status: 500 })
  }
}
