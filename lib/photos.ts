import 'server-only'
import { asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { mealPhotoVotes, mealPhotos, users } from '@/lib/db/schema'

export const MAX_PHOTOS_PER_MEAL = 60
export const MAX_REVIEW_PHOTOS = 6

export type PhotoView = {
  id: string
  path: string
  thumbPath: string
  width: number | null
  height: number | null
  source: 'meal' | 'review'
  userId: string | null
  userName: string | null
  createdAt: number
  voters: { id: string; name: string; avatarPath: string | null }[]
}

/** 一顿饭的全部照片（按上传时间）+ 每张的投票人 */
export function getMealPhotos(mealId: string): PhotoView[] {
  const rows = db
    .select({
      id: mealPhotos.id,
      path: mealPhotos.path,
      thumbPath: mealPhotos.thumbPath,
      width: mealPhotos.width,
      height: mealPhotos.height,
      source: mealPhotos.source,
      userId: mealPhotos.userId,
      userName: users.name,
      createdAt: mealPhotos.createdAt,
    })
    .from(mealPhotos)
    .leftJoin(users, eq(mealPhotos.userId, users.id))
    .where(eq(mealPhotos.mealId, mealId))
    .orderBy(asc(mealPhotos.createdAt))
    .all()
  const votes = db
    .select({ photoId: mealPhotoVotes.photoId, id: users.id, name: users.name, avatarPath: users.avatarPath })
    .from(mealPhotoVotes)
    .innerJoin(users, eq(mealPhotoVotes.userId, users.id))
    .where(eq(mealPhotoVotes.mealId, mealId))
    .orderBy(asc(mealPhotoVotes.createdAt))
    .all()
  return rows.map((r) => ({
    ...r,
    voters: votes.filter((v) => v.photoId === r.id).map(({ id, name, avatarPath }) => ({ id, name, avatarPath })),
  }))
}

/** 稳定的「随机」：同一顿饭永远选同一张 */
function stableIndex(seed: string, n: number): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % n
}

/**
 * 饭局列表封面（缩略图路径）：
 * 得票最多的照片；平票取「最先拿到这个票数」的那张；没人投票就按饭局 ID 固定随机一张。
 */
export function getMealCovers(mealIds: string[]): Map<string, string> {
  const map = new Map<string, string>()
  if (mealIds.length === 0) return map
  const photos = db
    .select({ id: mealPhotos.id, mealId: mealPhotos.mealId, thumb: mealPhotos.thumbPath })
    .from(mealPhotos)
    .where(inArray(mealPhotos.mealId, mealIds))
    .orderBy(asc(mealPhotos.createdAt))
    .all()
  if (photos.length === 0) return map
  const votes = db
    .select({ mealId: mealPhotoVotes.mealId, photoId: mealPhotoVotes.photoId, at: mealPhotoVotes.createdAt })
    .from(mealPhotoVotes)
    .where(inArray(mealPhotoVotes.mealId, mealIds))
    .orderBy(asc(mealPhotoVotes.createdAt))
    .all()

  const byMeal = new Map<string, typeof photos>()
  for (const p of photos) byMeal.set(p.mealId, [...(byMeal.get(p.mealId) ?? []), p])
  for (const [mealId, list] of byMeal) {
    const vs = votes.filter((v) => v.mealId === mealId)
    let best: { thumb: string; count: number; reachedAt: number } | null = null
    for (const p of list) {
      const mine = vs.filter((v) => v.photoId === p.id)
      if (mine.length === 0) continue
      const cand = { thumb: p.thumb, count: mine.length, reachedAt: mine[mine.length - 1].at }
      if (!best || cand.count > best.count || (cand.count === best.count && cand.reachedAt < best.reachedAt)) best = cand
    }
    map.set(mealId, best ? best.thumb : list[stableIndex(mealId, list.length)].thumb)
  }
  return map
}
