import Link from 'next/link'
import { Plus, ChefHat, Sparkles } from 'lucide-react'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { dishes as dishesTable } from '@/lib/db/schema'
import { requireUser, listMembers } from '@/lib/auth/user'
import { getT } from '@/lib/i18n/server'
import {
  buildMenu,
  getCookLogsFor,
  getCookStats,
  getMenuDishes,
  getSeasonal,
  listCategories,
  type MenuDish,
} from '@/lib/menus'
import { MENUS, isMenuId, HOME_MIN_COOKS } from '@/lib/menu-config'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { DishCard } from '@/components/dishes/dish-card'
import { DishForm, type DishSheetExtra } from '@/components/dishes/dish-form'
import type { Dish } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

/**
 * 菜品页（GanCook-10k · P2 第 1 步：功能版）。
 * 已接入：分类分组、做过次数排序、家常 / 完整两个菜单、本季推荐、常做 TOP。
 * 第 2 步会换成奈雪式布局（左侧分类导航 + 两列卡片 + 时令海报）。
 */
export default async function DishesPage({
  searchParams,
}: {
  searchParams: Promise<{ menu?: string }>
}) {
  const me = await requireUser()
  const t = await getT()
  const sp = await searchParams
  const menuId = isMenuId(sp.menu) ? sp.menu : 'home'

  const categories = listCategories()
  const all = getMenuDishes()
  const archived = db
    .select()
    .from(dishesTable)
    .where(eq(dishesTable.status, 'archived'))
    .orderBy(desc(dishesTable.createdAt))
    .all()
  const menu = buildMenu(menuId, all, categories)
  const seasonal = getSeasonal(all)
  const stats = getCookStats()
  const logs = getCookLogsFor([...all.map((d) => d.id), ...archived.map((d) => d.id)])
  const memberNames = Object.fromEntries(listMembers().map((m) => [m.id, m.name]))
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? null

  const baseExtra: Omit<DishSheetExtra, 'cook'> = {
    categories: categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId })),
    meId: me.id,
    isAdmin: me.isAdmin,
    memberNames,
  }
  const canManage = (createdBy: string | null) => createdBy === me.id || me.isAdmin

  const card = (dish: MenuDish | Dish, key: string, dimmed = false) => {
    const md = 'cook' in dish ? dish : null
    const extra: DishSheetExtra = {
      ...baseExtra,
      cook: {
        total: md?.cook.total ?? stats.get(dish.id)?.total ?? 0,
        last: md?.cook.last ?? stats.get(dish.id)?.last ?? null,
        logs: logs.get(dish.id) ?? [],
      },
    }
    const total = extra.cook!.total
    return (
      <DishForm key={key} mode="edit" dish={dish} canManage={canManage(dish.createdBy)} extra={extra}>
        <DishCard
          dish={dish}
          dimmed={dimmed}
          cooked={total}
          cookedLabel={total > 0 ? t('dish.cookedN', { n: total }) : t('dish.cookedNone')}
          categoryName={catName(dish.subcategory) ?? catName(dish.category)}
          isNew={md?.isNew}
          newLabel={t('dish.new')}
          pinnedLabel={t('dish.pinnedShort')}
        />
      </DishForm>
    )
  }

  const sectionTitle = (id: string, name: string) =>
    id === '__seasonal' ? t('menu.seasonal') : id === '__top' ? t('menu.top') : name

  const addButton = (label: string, size: 'sm' | 'md' = 'sm') => (
    <DishForm mode="create" extra={baseExtra}>
      <Button size={size}>
        <Plus className="h-4 w-4" />
        {label}
      </Button>
    </DishForm>
  )

  return (
    <>
      <PageHeader
        title={t('dishes.title')}
        subtitle={t('dishes.count', { n: all.length })}
        action={addButton(t('common.add'))}
      />

      {all.length === 0 && archived.length === 0 ? (
        <EmptyState
          icon={<ChefHat />}
          title={t('dishes.emptyTitle')}
          description={t('dishes.emptyDesc')}
          action={addButton(t('dishes.addFirst'), 'md')}
        />
      ) : (
        <>
          {/* 菜单切换（家常 / 完整），用链接实现，刷新也保持 */}
          <div className="mf-trough mb-4 flex p-1">
            {MENUS.map((m) => (
              <Link
                key={m.id}
                href={m.id === 'home' ? '/dishes' : `/dishes?menu=${m.id}`}
                className={cn(
                  'relative flex-1 rounded-full px-3 py-2 text-center text-sm font-medium',
                  m.id === menuId ? 'mf-bump text-accent' : 'text-secondary',
                )}
              >
                {t(m.labelKey)}
              </Link>
            ))}
          </div>
          <p className="mb-4 px-1 text-xs leading-relaxed text-secondary">
            {menuId === 'home'
              ? t('menu.homeRule', { n: HOME_MIN_COOKS })
              : t('menu.fullRule')}
          </p>

          {menu.fallbackAll && (
            <div className="mf-tonal mb-4 flex items-start gap-2 p-4 text-sm text-ink">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>{t('menu.fallbackHint')}</span>
            </div>
          )}

          {seasonal.dishes.length > 0 && (
            <p className="mb-4 px-1 text-xs text-secondary">
              {seasonal.auto ? t('menu.seasonalAuto') : t('menu.seasonalPicked')}
            </p>
          )}

          <div className="space-y-7">
            {menu.sections.map((sec) => (
              <section key={sec.id}>
                <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-ink">
                  {sectionTitle(sec.id, sec.name)}
                  {sec.badge && (
                    <span className="rounded-full bg-[var(--mf-role-prep)] px-2 py-0.5 text-[10px] font-semibold text-white">
                      {sec.badge}
                    </span>
                  )}
                  <span className="text-xs font-normal text-secondary">{sec.dishes.length}</span>
                </h2>
                {sec.groups ? (
                  <div className="space-y-4">
                    {sec.groups.map((g) => (
                      <div key={g.id}>
                        {g.name && (
                          <p className="mb-2 pl-1 text-xs font-semibold text-secondary">{g.name}</p>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          {g.dishes.map((d) => card(d, `${g.id}-${d.id}`))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {sec.dishes.map((d) => card(d, `${sec.id}-${d.id}`))}
                  </div>
                )}
              </section>
            ))}
          </div>

          {archived.length > 0 && (
            <>
              <p className="mb-3 mt-7 text-sm font-medium text-secondary">
                {t('dishes.archived')}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {archived.map((d) => card(d, `arch-${d.id}`, true))}
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}
