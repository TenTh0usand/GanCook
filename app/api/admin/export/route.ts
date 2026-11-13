import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/user'
import { createBackup, type BackupKind } from '@/lib/backup'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET /api/admin/export?kind=full|dishes —— 下载备份 JSON（仅管理员） */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user?.isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const kind: BackupKind = req.nextUrl.searchParams.get('kind') === 'dishes' ? 'dishes' : 'full'
  const backup = await createBackup(kind)
  const stamp = backup.exportedAt.replace(/[-:]/g, '').replace('T', '-').slice(0, 13)
  const filename = `gancook-${kind === 'full' ? 'backup' : 'dishes'}-${stamp}.json`

  return new NextResponse(JSON.stringify(backup), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
