import { Plus, ChefHat } from 'lucide-react'
import { requireUser, listMembers } from '@/lib/auth/user'
import { getT } from '@/lib/i18n/server'
import { getCookLogsFor, getMenuBrowserData, listCategories } from '@/lib/menus'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { DishForm, type DishSheetExtra } from '@/components/dishes/dish-form'
import { DishesMenu } from '@/components/menu/dishes-menu'

export const dynamic = 'force-dynamic'

/**
 * 菜品页（GanCook-10k · P2 第 2 步：奈雪式布局）。
 * 搜索 → 时令海报 → 家常 / 完整菜单 → 左侧分类导航 + 两列卡片；点卡片打开菜品弹窗。
 */
export default async function DishesPage() {
  const me = await requireUser()
  const t = await getT()

  const categories = listCategories()
  const data = getMenuBrowserData(t, { includeArchived: true })
  const ids = Object.keys(data.dishes)
  const logsByDish = Object.fromEntries(getCookLogsFor(ids))
  const extraBase: Omit<DishSheetExtra, 'cook'> = {
    categories: categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId })),
    meId: me.id,
    isAdmin: me.isAdmin,
    memberNames: Object.fromEntries(listMembers().map((m) => [m.id, m.name])),
  }

  if (ids.length === 0) {
    return (
      <>
        <PageHeader
          title={t('dishes.title')}
          subtitle={t('dishes.count', { n: 0 })}
          action={
            <DishForm mode="create" extra={extraBase}>
              <Button size="sm">
                <Plus className="h-4 w-4" />
                {t('common.add')}
              </Button>
            </DishForm>
          }
        />
        <EmptyState
          icon={<ChefHat />}
          title={t('dishes.emptyTitle')}
          description={t('dishes.emptyDesc')}
          action={
            <DishForm mode="create" extra={extraBase}>
              <Button>
                <Plus className="h-4 w-4" />
                {t('dishes.addFirst')}
              </Button>
            </DishForm>
          }
        />
      </>
    )
  }

  return <DishesMenu data={data} extraBase={extraBase} logsByDish={logsByDish} />
}
