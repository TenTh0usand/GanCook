import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, Clock, Timer, ChefHat, Soup, Store, Wallet, Users } from 'lucide-react'
import { requireUser, listMembers } from '@/lib/auth/user'
import { getSettings } from '@/lib/settings'
import { getMealDetail } from '@/lib/meals'
import { getSlotRoles } from '@/lib/duties'
import { MEAL_EMOJI, fmtTime, fmtDateLabel, deadlineText, nowSec } from '@/lib/time'
import { getT } from '@/lib/i18n/server'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { List, Row } from '@/components/ui/list'
import { STATUS_META } from '@/components/meals/meal-card'
import { MealControls } from '@/components/meals/meal-controls'
import { MealRolesCard } from '@/components/meals/meal-roles-card'
import { ReviewSection } from '@/components/meals/review-section'
import { MealModeCard } from '@/components/meals/meal-mode-card'
import { getOutingInfo, listVenueNames, fmtYuan } from '@/lib/outing'
import { OUT_EMOJI } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export default async function MealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const me = await requireUser()
  const detail = getMealDetail(id)
  if (!detail) notFound()
  const { meal, orders, reviews } = detail
  const tz = getSettings().timezone
  const t = await getT()

  const myOrders = orders.filter((o) => o.userId === me.id)

  // GanCook-10k：分工按「日期 + 时段」读取；一个餐次可以多人做菜
  const roles = getSlotRoles(meal.date, meal.mealType)
  const cooks = roles.cook
  const isCook = cooks.some((c) => c.userId === me.id) || meal.cookId === me.id
  const canManage = me.isAdmin || meal.createdBy === me.id || isCook
  const canDelete = me.isAdmin || meal.createdBy === me.id
  const orderingOpen =
    meal.status === 'ordering' && nowSec() < meal.orderDeadline

  // 按菜聚合「谁点了」
  const byDish = new Map<
    string,
    { id: string; name: string; image: string | null; people: { id: string; name: string; avatar: string | null }[] }
  >()
  for (const o of orders) {
    if (!byDish.has(o.dishId))
      byDish.set(o.dishId, { id: o.dishId, name: o.dishName, image: o.dishImage, people: [] })
    byDish.get(o.dishId)!.people.push({
      id: o.userId,
      name: o.userName,
      avatar: o.userAvatar,
    })
  }
  const dishGroups = [...byDish.values()].sort(
    (a, b) => b.people.length - a.people.length,
  )
  const participantCount = new Set(orders.map((o) => o.userId)).size

  const status = STATUS_META[meal.status]

  // GanCook-10k（P5）：外出
  const isOut = meal.kind === 'out'
  const outing = getOutingInfo([meal.id]).get(meal.id)!
  const outSummary =
    [outing.venueName, outing.perCents != null ? t('outing.perShort', { n: fmtYuan(outing.perCents) }) : null]
      .filter(Boolean)
      .join(' · ') || null
  const members = listMembers().map((m) => ({ id: m.id, name: m.name, avatarPath: m.avatarPath }))

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/meals"
          className="-ml-1 inline-flex items-center text-secondary"
        >
          <ChevronLeft className="h-5 w-5" />
          {t('nav.meals')}
        </Link>
        <Badge tone={status.tone}>{t(status.labelKey)}</Badge>
      </div>

      {/* 信息卡 */}
      <div className="mf-raised mb-4 p-5">
        <div className="relative flex items-center gap-3">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-2xl text-3xl ${isOut ? 'bg-[rgb(var(--mf-role-out-soft)/0.16)]' : status.tile}`}
          >
            {isOut ? (outing.category ? OUT_EMOJI[outing.category] : '🏪') : MEAL_EMOJI[meal.mealType]}
          </div>
          <div>
            <h1 className="tracking-title text-xl font-bold text-ink">
              {meal.title ||
                `${fmtDateLabel(meal.date, tz, t)} ${t('meal.' + meal.mealType)}`}
            </h1>
            <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-secondary">
              <Clock className="h-4 w-4" />
              {t('detail.eatAt', {
                date: fmtDateLabel(meal.date, tz, t),
                time: fmtTime(meal.diningTime, tz),
              })}
            </p>
          </div>
        </div>

        {isOut ? (
          <div className="relative mt-4 flex flex-col gap-2 border-t border-black/[0.04] pt-4 text-sm">
            <div className="flex items-center gap-2 text-ink">
              <Store className="h-4 w-4 text-[var(--mf-role-out)]" />
              <span className="font-medium">{outing.venueName ?? t('outing.label')}</span>
              {outing.category && (
                <span className="text-secondary">
                  {OUT_EMOJI[outing.category]} {t(`outing.cat.${outing.category}`)}
                </span>
              )}
            </div>
            {(outing.totalCents != null || outing.perCents != null) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-secondary">
                <Wallet className="h-4 w-4" />
                {outing.totalCents != null && <span>{t('outing.totalShort', { n: fmtYuan(outing.totalCents) })}</span>}
                {outing.perCents != null && (
                  <span className="font-semibold text-[var(--mf-role-out)]">
                    {t('outing.perShort', { n: fmtYuan(outing.perCents) })}
                  </span>
                )}
                {outing.paidCents != null && outing.paidCents !== outing.totalCents && (
                  <span>{t('outing.paidShort', { n: fmtYuan(outing.paidCents) })}</span>
                )}
              </div>
            )}
            {outing.companions.length > 0 && (
              <div className="flex items-center gap-2 text-ink">
                <Users className="h-4 w-4 text-secondary" />
                <span className="flex -space-x-1.5">
                  {outing.companions.map((c) => (
                    <Avatar
                      key={c.id}
                      name={c.name}
                      src={c.avatarPath ? `/api/uploads/${c.avatarPath}` : null}
                      size={22}
                      className="ring-2 ring-[var(--mf-surface)]"
                    />
                  ))}
                </span>
                {outing.companions.map((c) => c.name).join(t('common.listSep'))}
              </div>
            )}
          </div>
        ) : (
        <div className="relative mt-4 flex flex-col gap-2 border-t border-black/[0.04] pt-4 text-sm">
          <div className="flex items-center gap-2 text-secondary">
            <Timer className="h-4 w-4" />
            {meal.status === 'ordering'
              ? deadlineText(meal.orderDeadline, tz, t)
              : meal.status === 'cancelled'
                ? t('detail.orderCancelled')
                : t('detail.orderEnded')}
          </div>
          <div className="flex items-center gap-2">
            <ChefHat className="h-4 w-4 text-accent" />
            {cooks.length > 0 ? (
              <span className="inline-flex flex-wrap items-center gap-1.5 text-ink">
                <span className="flex -space-x-1.5">
                  {cooks.map((c) => (
                    <Avatar
                      key={c.userId}
                      name={c.name}
                      src={c.avatarPath ? `/api/uploads/${c.avatarPath}` : null}
                      size={22}
                      className="ring-2 ring-[var(--mf-surface)]"
                    />
                  ))}
                </span>
                {t('detail.cook', {
                  name: cooks.map((c) => c.name).join(t('common.listSep')),
                })}
              </span>
            ) : (
              <span className="text-secondary">{t('detail.noCook')}</span>
            )}
          </div>
        </div>
        )}
      </div>

      {/* 控制 */}
      <div className="mb-6">
        <MealControls
          meal={meal}
          isCook={isCook}
          othersCooking={cooks.some((c) => c.userId !== me.id)}
          canManage={canManage}
          canDelete={canDelete}
          isOut={isOut}
        />
      </div>

      {/* 点菜：GanCook-10k（P2）改为进入全屏点菜页 */}
      {meal.status !== 'cancelled' && (
        <MealModeCard
          mealId={meal.id}
          kind={meal.kind}
          orderingOpen={orderingOpen}
          myOrderNames={myOrders.map((o) => o.dishName)}
          totalOrders={orders.length}
          outSummary={outSummary}
          outing={{
            venueName: outing.venueName,
            category: outing.category,
            totalCents: outing.totalCents,
            headcount: outing.headcount,
            paidCents: outing.paidCents,
            companionIds: outing.companions.map((c) => c.id),
          }}
          venues={listVenueNames()}
          members={members}
          meId={me.id}
        />
      )}

      {/* 大家点了什么 */}
      {!isOut && (
      <section>
        <h2 className="mb-3 text-base font-semibold text-ink">
          {t('detail.who')}
          {participantCount > 0 && (
            <span className="ml-2 text-sm font-normal text-secondary">
              {t('detail.summary', {
                p: participantCount,
                d: dishGroups.length,
              })}
            </span>
          )}
        </h2>
        {dishGroups.length === 0 ? (
          <div className="rounded-2xl mf-inset p-5 text-center text-sm text-secondary">
            {orderingOpen
              ? t('detail.noOrdersOpen')
              : t('detail.noOrdersClosed')}
          </div>
        ) : (
          <List>
            {dishGroups.map((g) => (
              <Row
                key={g.id}
                chevron={false}
                leading={
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-trough">
                    {g.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/uploads/${g.image}`}
                        alt={g.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Soup className="h-5 w-5 text-secondary/40" />
                    )}
                  </span>
                }
                title={g.name}
                subtitle={g.people.map((p) => p.name).join(t('common.listSep'))}
                trailing={
                  <span className="rounded-[var(--radius-chip)] bg-[rgb(var(--mf-accent-soft)/0.15)] px-2.5 py-1 text-sm font-semibold text-accent">
                    ×{g.people.length}
                  </span>
                }
              />
            ))}
          </List>
        )}
      </section>
      )}

      {/* GanCook-10k：这顿的分工（备菜 / 做菜 / 善后）——放在点菜之后，不挡点菜 */}
      {meal.status !== 'cancelled' && !isOut && (
        <div className="mt-6">
          <MealRolesCard
            date={meal.date}
            slot={meal.mealType}
            roles={roles}
            meId={me.id}
          />
        </div>
      )}

      {meal.status === 'done' && (
        <ReviewSection mealId={meal.id} reviews={reviews} meId={me.id} />
      )}
    </>
  )
}
