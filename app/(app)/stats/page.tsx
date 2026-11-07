import { Flame, BarChart3 } from 'lucide-react'
import { requireUser } from '@/lib/auth/user'
import { getContributions } from '@/lib/contributions'
import { getT } from '@/lib/i18n/server'
import { CONTRIB_KINDS, DAILY_BINARY_KINDS, ROLE_META, roleTint } from '@/lib/roles'
import { PageHeader } from '@/components/page-header'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { ContributionHeatmap } from '@/components/contribution-heatmap'
import {
  RoleFilterProvider,
  RoleFilterBar,
  RoleVisible,
} from '@/components/stats/role-filter'

export const dynamic = 'force-dynamic'

/**
 * 统计页（GanCook-10k：原「贡献墙」改名扩展）。
 * 本期（P1）只有「家务贡献」；外出足迹、花费在 P4 加入，届时顶部加分段切换。
 */
export default async function StatsPage() {
  await requireUser()
  const t = await getT()
  const { members, today, weeks } = getContributions()

  const hasAny = members.some((m) => CONTRIB_KINDS.some((k) => m.totals[k] > 0))

  return (
    <>
      <PageHeader title={t('stats.title')} subtitle={t('stats.sub')} />

      {!hasAny ? (
        <EmptyState
          icon={<BarChart3 />}
          title={t('wall.emptyTitle')}
          description={t('stats.emptyDesc')}
        />
      ) : (
        <RoleFilterProvider>
          <RoleFilterBar />
          <div className="space-y-4">
            {members.map((m) => (
              <div key={m.id} className="mf-raised p-4">
                <div className="relative flex items-center gap-3">
                  <Avatar
                    name={m.name}
                    src={m.avatarPath ? `/api/uploads/${m.avatarPath}` : null}
                    size={42}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-ink">{m.name}</p>
                      {m.streak > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-[#c2410c]">
                          <Flame className="h-3.5 w-3.5" />
                          {t('wall.streak', { n: m.streak })}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {CONTRIB_KINDS.map((k) => (
                        <span
                          key={k}
                          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          style={{ background: roleTint(k, 0.15), color: ROLE_META[k].color }}
                        >
                          {t(`${ROLE_META[k].labelKey}.short`)} {m.totals[k]}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="relative mt-4 space-y-3">
                  {CONTRIB_KINDS.map((k) => {
                    const binary = DAILY_BINARY_KINDS.includes(k)
                    return (
                      <RoleVisible key={k} kind={k}>
                        <ContributionHeatmap
                          data={m.byDate[k]}
                          raw={m.raw[k]}
                          today={today}
                          weeks={weeks}
                          cellSize={13}
                          softVar={ROLE_META[k].soft}
                          binary={binary}
                          unit={t('stats.unitTimes')}
                          label={
                            binary
                              ? `${t(ROLE_META[k].labelKey)} · ${t('stats.byDay')}`
                              : t(ROLE_META[k].labelKey)
                          }
                        />
                      </RoleVisible>
                    )
                  })}
                </div>
              </div>
            ))}

            <p className="px-1 text-xs leading-relaxed text-secondary">
              {t('stats.legendNote')}
            </p>
          </div>
        </RoleFilterProvider>
      )}
    </>
  )
}
