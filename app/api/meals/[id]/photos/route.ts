import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { mealPhotos } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/user'
import { getMeal } from '@/lib/meals'
import { savePhoto } from '@/lib/images'
import { MAX_PHOTOS_PER_MEAL, MAX_REVIEW_PHOTOS } from '@/lib/photos'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// 手机端已压到 2MB 以下；万一前端压缩失败（如个别格式），服务器兜底压缩，原图最多收 15MB
const MAX_RAW = 15 * 1024 * 1024

/** POST /api/meals/:id/photos（multipart: file, source=meal|review）—— 上传一张照片 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ ok: false, error: 'LOGIN' }, { status: 401 })
  const meal = getMeal(id)
  if (!meal) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ ok: false, error: 'BAD_FILE' }, { status: 400 })
  }
  const file = form.get('file')
  const source = form.get('source') === 'review' ? 'review' : 'meal'
  if (!(file instanceof File) || !file.type.startsWith('image/'))
    return NextResponse.json({ ok: false, error: 'BAD_FILE' }, { status: 400 })
  if (file.size > MAX_RAW) return NextResponse.json({ ok: false, error: 'TOO_LARGE' }, { status: 413 })

  const count = (where: ReturnType<typeof and>) =>
    db.select({ c: sql<number>`count(*)` }).from(mealPhotos).where(where).get()?.c ?? 0
  if (count(eq(mealPhotos.mealId, id)) >= MAX_PHOTOS_PER_MEAL)
    return NextResponse.json({ ok: false, error: 'LIMIT_MEAL' }, { status: 400 })
  if (
    source === 'review' &&
    count(and(eq(mealPhotos.mealId, id), eq(mealPhotos.userId, me.id), eq(mealPhotos.source, 'review'))) >=
      MAX_REVIEW_PHOTOS
  )
    return NextResponse.json({ ok: false, error: 'LIMIT_REVIEW' }, { status: 400 })

  let saved
  try {
    saved = await savePhoto(Buffer.from(await file.arrayBuffer()))
  } catch (err) {
    console.error('[photos] save failed', err)
    const msg = String((err as Error)?.message ?? '')
    return NextResponse.json({ ok: false, error: msg.includes('S3') ? 'STORAGE' : 'BAD_FILE' }, { status: 500 })
  }
  db.insert(mealPhotos)
    .values({
      id: saved.id,
      mealId: id,
      userId: me.id,
      source,
      path: saved.path,
      thumbPath: saved.thumbPath,
      width: saved.width,
      height: saved.height,
    })
    .run()
  revalidatePath(`/meals/${id}`)
  revalidatePath('/meals')
  revalidatePath('/home')
  return NextResponse.json({ ok: true, id: saved.id })
}
