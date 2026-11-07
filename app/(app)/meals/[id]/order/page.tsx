import { notFound, redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/user'
import { getSettings } from '@/lib/settings'
import { getMeal, myOrderedDishIds } from '@/lib/meals'
import { getMenuBrowserData } from '@/lib/menus'
import { fmtDateLabel, deadlineText, nowSec } from '@/lib/time'
import { getT } from '@/lib/i18n/server'
import { OrderMenu } from '@/components/menu/order-menu'

export const dynamic = 'force-dynamic'

/**
 * 全屏点菜页（GanCook-10k · P2 第 3 步）：/meals/[id]/order
 * 点菜已截止 / 饭局不在点菜中时，直接回到饭局详情。
 */
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await requireUser()
  const meal = getMeal(id)
  if (!meal) notFound()
  if (meal.status !== 'ordering' || nowSec() >= meal.orderDeadline) redirect(`/meals/${id}`)

  const t = await getT()
  const tz = getSettings().timezone
  const title =
    meal.title || `${fmtDateLabel(meal.date, tz, t)} ${t('meal.' + meal.mealType)}`

  return (
    <OrderMenu
      mealId={id}
      title={t('order.title', { meal: title })}
      subtitle={deadlineText(meal.orderDeadline, tz, t)}
      data={getMenuBrowserData(t)}
      initialPicked={[...myOrderedDishIds(id, me.id)]}
    />
  )
}
