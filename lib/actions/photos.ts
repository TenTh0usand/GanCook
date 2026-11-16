'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { mealPhotoVotes, mealPhotos } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/user'
import { getT } from '@/lib/i18n/server'
import { deleteImage } from '@/lib/images'
import type { ActionResult } from '@/lib/actions/meals'

function revalidateMeal(mealId: string) {
  revalidatePath(`/meals/${mealId}`)
  revalidatePath('/meals')
  revalidatePath('/home')
}

/** 删除照片（上传者本人或管理员）；投给它的票一起删除 */
export async function deletePhoto(id: string): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  const p = db.select().from(mealPhotos).where(eq(mealPhotos.id, id)).get()
  if (!p) return { ok: true }
  if (p.userId !== me.id && !me.isAdmin) return { ok: false, error: t('err.onlyOwnPhoto') }
  db.delete(mealPhotos).where(eq(mealPhotos.id, id)).run()
  await deleteImage(p.path)
  await deleteImage(p.thumbPath)
  revalidateMeal(p.mealId)
  return { ok: true }
}

/** 投票：每人每顿一票；投另一张 = 改票；再点同一张 = 撤票 */
export async function togglePhotoVote(mealId: string, photoId: string): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  const photo = db.select({ mealId: mealPhotos.mealId }).from(mealPhotos).where(eq(mealPhotos.id, photoId)).get()
  if (!photo || photo.mealId !== mealId) return { ok: false, error: t('err.badInput') }
  db.transaction(() => {
    const cur = db
      .select()
      .from(mealPhotoVotes)
      .where(and(eq(mealPhotoVotes.mealId, mealId), eq(mealPhotoVotes.userId, me.id)))
      .get()
    db.delete(mealPhotoVotes).where(and(eq(mealPhotoVotes.mealId, mealId), eq(mealPhotoVotes.userId, me.id))).run()
    if (cur?.photoId !== photoId) db.insert(mealPhotoVotes).values({ mealId, userId: me.id, photoId }).run()
  })
  revalidateMeal(mealId)
  return { ok: true }
}
