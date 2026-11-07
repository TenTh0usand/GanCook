'use client'

import * as React from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/i18n-provider'
import { MenuBrowser } from '@/components/menu/menu-browser'
import { DishForm, type DishSheetExtra } from '@/components/dishes/dish-form'
import type { CookLogItem } from '@/components/dishes/dish-cook-section'
import type { BrowserDish, MenuBrowserData } from '@/lib/menu-config'

/**
 * 菜品页（管理模式）的客户端外壳（GanCook-10k · P2）：
 * 菜单浏览组件 + 每张卡片 / 海报包一层菜品弹窗。
 */
export function DishesMenu({
  data,
  extraBase,
  logsByDish,
}: {
  data: MenuBrowserData
  extraBase: Omit<DishSheetExtra, 'cook'>
  logsByDish: Record<string, CookLogItem[]>
}) {
  const t = useT()
  const activeCount = Object.values(data.dishes).filter((d) => d.status === 'active').length

  const wrap = (dish: BrowserDish, node: React.ReactElement, key: string) => (
    <DishForm
      key={key}
      mode="edit"
      dish={dish}
      canManage={dish.createdBy === extraBase.meId || extraBase.isAdmin}
      extra={{
        ...extraBase,
        cook: { total: dish.cookTotal, last: dish.cookLast, logs: logsByDish[dish.id] ?? [] },
      }}
    >
      {node}
    </DishForm>
  )

  return (
    <MenuBrowser
      data={data}
      wrap={wrap}
      header={
        <header className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h1 className="tracking-title text-2xl font-bold text-ink">{t('dishes.title')}</h1>
            <p className="mt-0.5 text-sm text-secondary">{t('dishes.count', { n: activeCount })}</p>
          </div>
          <DishForm mode="create" extra={extraBase}>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              {t('common.add')}
            </Button>
          </DishForm>
        </header>
      }
    />
  )
}
