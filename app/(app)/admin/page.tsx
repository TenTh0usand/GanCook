import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { requireAdmin, listMembers } from '@/lib/auth/user'
import { getSettings } from '@/lib/settings'
import { db } from '@/lib/db/client'
import { mealSchedules, dishes, menuFeatures } from '@/lib/db/schema'
import { asc } from 'drizzle-orm'
import { todayLocal } from '@/lib/time'
import { getCookStats, listCategories } from '@/lib/menus'
import { PageHeader } from '@/components/page-header'
import { getT } from '@/lib/i18n/server'
import { FamilySettings } from '@/components/admin/family-settings'
import { FeatureManager } from '@/components/admin/feature-manager'
import { CategoryManager } from '@/components/admin/category-manager'
import { ScheduleEditor } from '@/components/admin/schedule-editor'
import { MembersManager } from '@/components/admin/members-manager'
import { RunSchedule } from '@/components/admin/run-schedule'
import { UpdatePanel } from '@/components/admin/update-panel'
import { APP_VERSION, IMAGE_REPO } from '@/lib/version'
import { updateCapability } from '@/lib/update'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const me = await requireAdmin()
  const t = await getT()
  const s = getSettings()
  const capability = await updateCapability()
  const schedules = db
    .select()
    .from(mealSchedules)
    .all()
    .sort((a, b) => a.createdAt - b.createdAt)
  const members = listMembers().map((m) => ({
    id: m.id,
    name: m.name,
    avatarPath: m.avatarPath,
    isAdmin: m.isAdmin,
  }))

  // GanCook-10k（P2）：菜单设置数据
  const today = todayLocal(s.timezone)
  const categories = listCategories().map((c) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
    badge: c.badge,
  }))
  const knownMain = new Set(categories.filter((c) => !c.parentId).map((c) => c.id))
  const allDishes = db.select().from(dishes).all()
  const categoryCounts: Record<string, number> = {}
  for (const d of allDishes) {
    const main = d.category && knownMain.has(d.category) ? d.category : 'other'
    categoryCounts[main] = (categoryCounts[main] ?? 0) + 1
    if (d.subcategory) categoryCounts[d.subcategory] = (categoryCounts[d.subcategory] ?? 0) + 1
  }
  const features = db
    .select()
    .from(menuFeatures)
    .orderBy(asc(menuFeatures.sort), asc(menuFeatures.createdAt))
    .all()
    .map((f) => ({
      id: f.id,
      dishId: f.dishId,
      title: f.title,
      posterPath: f.posterPath,
      startDate: f.startDate,
      endDate: f.endDate,
    }))
  const cookStats = getCookStats()
  const featureDishes = allDishes
    .map((d) => ({
      id: d.id,
      name: d.name,
      imagePath: d.imagePath,
      cookTotal: cookStats.get(d.id)?.total ?? 0,
      archived: d.status === 'archived',
    }))
    .sort((a, b) => b.cookTotal - a.cookTotal || a.name.localeCompare(b.name, 'zh-CN'))

  return (
    <>
      <div className="mb-4">
        <Link href="/me" className="-ml-1 inline-flex items-center text-secondary">
          <ChevronLeft className="h-5 w-5" />
          {t('me.title')}
        </Link>
      </div>
      <PageHeader title={t('admin.title')} />

      <section className="mb-7">
        <h2 className="mb-3 text-base font-semibold text-ink">
          {t('admin.family')}
        </h2>
        <FamilySettings
          familyName={s.familyName}
          registrationOpen={s.registrationOpen}
          joinCode={s.joinCode}
        />
      </section>

      {/* GanCook-10k（P2）：菜单设置 —— 本季推荐 + 分类管理 */}
      <section className="mb-7">
        <h2 className="mb-1 text-base font-semibold text-ink">{t('feature.sectionTitle')}</h2>
        <p className="mb-3 text-sm text-secondary">{t('feature.sectionDesc')}</p>
        <FeatureManager features={features} dishes={featureDishes} today={today} />
      </section>

      <section className="mb-7">
        <h2 className="mb-1 text-base font-semibold text-ink">{t('catmgr.sectionTitle')}</h2>
        <p className="mb-3 text-sm text-secondary">{t('catmgr.sectionDesc')}</p>
        <CategoryManager categories={categories} counts={categoryCounts} />
      </section>

      <section className="mb-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">
            {t('admin.autoMeals')}
          </h2>
        </div>
        <p className="mb-3 text-sm text-secondary">{t('admin.autoMealsDesc')}</p>
        <ScheduleEditor schedules={schedules} />
        <div className="mt-3">
          <RunSchedule />
        </div>
      </section>

      <section className="mb-7">
        <h2 className="mb-3 text-base font-semibold text-ink">
          {t('admin.members', { n: members.length })}
        </h2>
        <MembersManager members={members} meId={me.id} />
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-ink">
          {t('update.title')}
        </h2>
        <UpdatePanel
          current={APP_VERSION}
          capability={capability}
          imageRepo={IMAGE_REPO}
        />
      </section>
    </>
  )
}
