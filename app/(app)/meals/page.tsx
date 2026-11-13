import { Plus, UtensilsCrossed } from 'lucide-react'
import { requireUser, listMembers } from '@/lib/auth/user'
import { getSettings } from '@/lib/settings'
import { listMeals, getMealParticipantCounts, getMealScores, getMealDishNames } from '@/lib/meals'
import { getCookNamesBySlot } from '@/lib/duties'
import { dayjs, todayLocal } from '@/lib/time'
import { getT } from '@/lib/i18n/server'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { MealCard } from '@/components/meals/meal-card'
import { CreateMealDialog } from '@/components/meals/create-meal-dialog'
import { MealSearch } from '@/components/meals/meal-search'

export const dynamic = 'force-dynamic'

export default async function MealsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; q?: string }>
}) {
  await requireUser()
  const sp = await searchParams
  const qDate = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? '') ? sp.date! : ''
  const qText = (sp.q ?? '').trim().slice(0, 40)
  const t = await getT()
  const tz = getSettings().timezone
  const meals = listMeals()
  const mealIds = meals.map((m) => m.id)

  // 每个饭局的点菜人数
  const participants = getMealParticipantCounts(mealIds)
  const members = new Map(listMembers().map((m) => [m.id, m.name]))
  // GanCook-10k：一个餐次可多人做菜，卡片上显示全部做菜人
  const cookNames = getCookNamesBySlot(meals.map((m) => m.date))
  // GanCook-10k（P3）：卡片上显示全家平均分
  const scores = getMealScores(mealIds)
  const dishNames = getMealDishNames(mealIds)
  const cookLabel = (m: (typeof meals)[number]) =>
    cookNames.get(`${m.date}|${m.mealType}`)?.join(t('common.listSep')) ??
    (m.cookId ? members.get(m.cookId) : null)

  // 搜索：按日期（营业日）+ 关键词（菜名 / 饭局名 / 餐次名）
  const searching = !!qDate || !!qText
  const kw = qText.toLowerCase()
  const results = searching
    ? meals.filter((m) => {
        if (qDate && m.date !== qDate) return false
        if (!kw) return true
        const hay = [m.title ?? '', t('meal.' + m.mealType), ...(dishNames.get(m.id) ?? [])]
        return hay.some((h) => h.toLowerCase().includes(kw))
      })
    : []

  const upcoming = meals
    .filter((m) => m.status === 'ordering' || m.status === 'cooking')
    .sort((a, b) => a.diningTime - b.diningTime)
  const history = meals.filter(
    (m) => m.status === 'done' || m.status === 'cancelled',
  )

  const today = todayLocal(tz)
  const tomorrow = dayjs(today).add(1, 'day').format('YYYY-MM-DD')

  const createBtn = (
    <CreateMealDialog today={today} tomorrow={tomorrow}>
      <Button size="sm">
        <Plus className="h-4 w-4" />
        {t('home.openMeal')}
      </Button>
    </CreateMealDialog>
  )

  return (
    <>
      <PageHeader title={t('meals.title')} action={createBtn} />

      {meals.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed />}
          title={t('meals.emptyTitle')}
          description={t('meals.emptyDesc')}
          action={
            <CreateMealDialog today={today} tomorrow={tomorrow}>
              <Button>
                <Plus className="h-4 w-4" />
                {t('meals.openFirst')}
              </Button>
            </CreateMealDialog>
          }
        />
      ) : (
        <div className="space-y-3">
          <MealSearch date={qDate} q={qText} />
          {searching ? (
            <>
              <p className="mb-1 text-sm font-medium text-secondary">
                {results.length > 0 ? t('meals.searchResult', { n: results.length }) : t('meals.searchNone')}
              </p>
              {results.map((m) => (
                <MealCard
                  key={m.id}
                  meal={m}
                  tz={tz}
                  cookName={cookLabel(m)}
                  score={scores.get(m.id)?.avg ?? null}
                  participants={participants.get(m.id) ?? 0}
                  dishes={dishNames.get(m.id)}
                />
              ))}
            </>
          ) : (
          <>
          {upcoming.map((m) => (
            <MealCard
              key={m.id}
              meal={m}
              tz={tz}
              cookName={cookLabel(m)}
              score={scores.get(m.id)?.avg ?? null}
              participants={participants.get(m.id) ?? 0}
            />
          ))}

          {history.length > 0 && (
            <>
              <p className="mb-1 mt-6 text-sm font-medium text-secondary">
                {t('meals.history')}
              </p>
              {history.map((m) => (
                <MealCard
                  key={m.id}
                  meal={m}
                  tz={tz}
                  cookName={cookLabel(m)}
                  score={scores.get(m.id)?.avg ?? null}
                  participants={participants.get(m.id) ?? 0}
                  dishes={dishNames.get(m.id)}
                />
              ))}
            </>
          )}
          <p className="pt-2 text-center text-xs text-secondary/80">{t('meals.autoPurgeHint')}</p>
          </>
          )}
        </div>
      )}
    </>
  )
}
