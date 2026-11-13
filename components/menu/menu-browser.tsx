'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Search, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/components/i18n-provider'
import { MenuDishCard } from '@/components/menu/menu-dish-card'
import { PosterCard } from '@/components/menu/poster-card'
import type { BrowserDish, MenuBrowserData, MenuId } from '@/lib/menu-config'

/** 吸顶的菜单切换栏高度（px），左侧导航吸在它下面；点击跳转时也用它做偏移 */
const TABS_H = 46
/** 底部导航 / 已点栏留白 */
const BOTTOM_GAP = 104

/**
 * 菜单浏览组件（GanCook-10k · P2，参考奈雪点单页）。
 *
 * 结构：搜索 → 时令海报（横滑）→ 菜单切换（吸顶）→ 左侧一列分类导航（吸顶）+ 右侧两列卡片。
 * - 点左侧分类：右侧平滑滚到对应位置
 * - 手动上下滑：左侧高亮自动跟随（并把高亮项滚进可视区）
 *
 * 两种模式共用：
 * - 管理模式（菜品页）：wrap 把卡片包进菜品弹窗
 * - 点菜模式（点菜页，第 3 步）：picked / onToggle
 */
export function MenuBrowser({
  data,
  wrap,
  picked,
  onToggle,
  header,
}: {
  data: MenuBrowserData
  /** 管理模式：把卡片 / 海报包一层（如菜品弹窗触发器） */
  wrap?: (dish: BrowserDish, node: React.ReactElement, key: string) => React.ReactNode
  /** 点菜模式：已点的菜 id */
  picked?: Set<string>
  onToggle?: (dishId: string) => void
  /** 搜索框上方的自定义内容（页面标题等） */
  header?: React.ReactNode
}) {
  const t = useT()
  const [menuId, setMenuId] = React.useState<MenuId>(data.menus[0]?.id ?? 'home')
  const [active, setActive] = React.useState<string | null>(null)
  const [q, setQ] = React.useState('')
  const lockRef = React.useRef<string | null>(null)
  const lockTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const navRef = React.useRef<HTMLDivElement>(null)
  const tabsRef = React.useRef<HTMLDivElement>(null)

  const menu = data.menus.find((m) => m.id === menuId) ?? data.menus[0]
  const sections = menu?.sections ?? []
  const orderMode = !!onToggle
  const anchor = (id: string) => `menu-${menuId}-${id}`

  const labels = (d: BrowserDish) => ({
    cooked: t('dish.cookedN', { n: d.cookTotal }),
    never: t('dish.cookedNone'),
    isNew: t('dish.new'),
    pinned: t('dish.pinnedShort'),
  })

  const renderCard = (id: string, key: string) => {
    const d = data.dishes[id]
    if (!d) return null
    const node = (
      <MenuDishCard
        dish={d}
        labels={labels(d)}
        picked={orderMode ? picked?.has(id) ?? false : undefined}
        dimmed={d.status === 'archived'}
        onClick={orderMode ? () => onToggle!(id) : undefined}
      />
    )
    return wrap ? wrap(d, node, key) : <React.Fragment key={key}>{node}</React.Fragment>
  }

  // ── 滚动联动：找出当前位于吸顶栏下方的分组 ──
  React.useEffect(() => {
    if (q) return
    let raf = 0
    const compute = () => {
      if (lockRef.current) return
      let current = sections[0]?.id ?? null
      for (const s of sections) {
        const el = document.getElementById(anchor(s.id))
        if (el && el.getBoundingClientRect().top - TABS_H <= 12) current = s.id
      }
      setActive(current)
    }
    const onScroll = () => {
      // 点击跳转期间：滚动停止 150ms 后解锁
      if (lockRef.current) {
        if (lockTimer.current) clearTimeout(lockTimer.current)
        lockTimer.current = setTimeout(() => {
          lockRef.current = null
          compute()
        }, 150)
        return
      }
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(compute)
    }
    compute()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuId, sections, q])

  // ── 左侧高亮项保持在可视区 ──
  React.useEffect(() => {
    const nav = navRef.current
    const item = nav?.querySelector<HTMLElement>(`[data-sec="${active}"]`)
    if (!nav || !item) return
    if (item.offsetTop < nav.scrollTop) nav.scrollTop = item.offsetTop - 8
    else if (item.offsetTop + item.offsetHeight > nav.scrollTop + nav.clientHeight)
      nav.scrollTop = item.offsetTop + item.offsetHeight - nav.clientHeight + 8
  }, [active])

  const jump = (id: string) => {
    const el = document.getElementById(anchor(id))
    if (!el) return
    lockRef.current = id
    setActive(id)
    const top = el.getBoundingClientRect().top + window.scrollY - TABS_H - 4
    window.scrollTo({ top, behavior: 'smooth' })
    if (lockTimer.current) clearTimeout(lockTimer.current)
    lockTimer.current = setTimeout(() => (lockRef.current = null), 900)
  }

  const switchMenu = (id: MenuId) => {
    if (id === menuId) return
    setMenuId(id)
    setActive(null)
    // 已经滚过菜单栏时，切换后回到菜单栏位置，避免停在半空
    const bar = tabsRef.current
    if (bar) {
      const barTop = bar.getBoundingClientRect().top + window.scrollY
      if (window.scrollY > barTop) window.scrollTo({ top: barTop })
    }
  }

  // ── 搜索：在全部菜里按菜名 / 标签 / 分类找（不限当前菜单） ──
  const query = q.trim().toLowerCase()
  const results = React.useMemo(() => {
    if (!query) return []
    return Object.values(data.dishes)
      .filter((d) =>
        [d.name, d.categoryName ?? '', ...(d.tags ?? [])].some((s) => s.toLowerCase().includes(query)),
      )
      .sort((a, b) => b.cookTotal - a.cookTotal)
  }, [query, data.dishes])

  const posters = data.posters.filter((p) => data.dishes[p.dishId])

  return (
    <div>
      {header}

      {/* 搜索 */}
      <div className="mf-inset mb-4 flex h-11 items-center gap-2 px-4">
        <Search className="h-4 w-4 shrink-0 text-secondary" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('menu.searchPh')}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-secondary/70"
        />
        {q && (
          <button type="button" onClick={() => setQ('')} aria-label={t('common.cancel')}>
            <X className="h-4 w-4 text-secondary" />
          </button>
        )}
      </div>

      {query ? (
        /* 搜索结果 */
        <section className="pb-6">
          <p className="mb-3 pl-1 text-sm font-semibold text-ink">
            {t('menu.searchResult', { n: results.length })}
          </p>
          {results.length === 0 ? (
            <p className="mf-inset rounded-2xl p-5 text-center text-sm text-secondary">{t('menu.searchNone')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">{results.map((d) => renderCard(d.id, `s-${d.id}`))}</div>
          )}
        </section>
      ) : (
        <>
          {/* 时令海报：横向滑动 */}
          {posters.length > 0 && (
            <div className="-mx-4 mb-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {posters.map((p) => {
                const d = data.dishes[p.dishId]
                const node = (
                  <PosterCard
                    dish={d}
                    title={p.title}
                    posterPath={p.posterPath}
                    cookedLabel={d.cookTotal > 0 ? t('dish.cookedN', { n: d.cookTotal }) : t('dish.cookedNone')}
                    picked={orderMode ? picked?.has(d.id) : undefined}
                    onClick={orderMode ? () => onToggle!(d.id) : undefined}
                  />
                )
                return wrap ? wrap(d, node, `p-${p.id}`) : <React.Fragment key={`p-${p.id}`}>{node}</React.Fragment>
              })}
            </div>
          )}

          {/* 菜单切换（吸顶 + 滑动下划线） */}
          <div
            ref={tabsRef}
            className="sticky top-0 z-20 -mx-4 flex items-end gap-6 border-b border-black/[0.04] bg-base/92 px-5 backdrop-blur-sm dark:border-white/[0.05]"
            style={{ height: TABS_H }}
          >
            {data.menus.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => switchMenu(m.id)}
                className={cn(
                  'relative pb-2.5 text-[15px] transition-colors',
                  m.id === menuId ? 'font-bold text-ink' : 'text-secondary hover:text-ink',
                )}
              >
                {m.label}
                {m.id === menuId && (
                  <motion.span
                    layoutId="menu-tab-bar"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute inset-x-1/4 bottom-0 h-[3px] rounded-full bg-accent"
                  />
                )}
              </button>
            ))}
          </div>

          {menu?.fallbackAll && (
            <div className="mf-tonal mb-3 mt-2 flex items-start gap-2 p-3.5 text-xs leading-relaxed text-ink">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
              <span>{t('menu.fallbackHint')}</span>
            </div>
          )}

          <div className="mt-2 flex gap-2.5">
            {/* 左侧分类导航：一列，吸顶 */}
            <nav
              ref={navRef}
              className="sticky w-[76px] shrink-0 self-start overflow-y-auto rounded-2xl bg-trough py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ top: TABS_H + 4, maxHeight: `calc(100dvh - ${TABS_H + 4 + BOTTOM_GAP}px)` }}
            >
              {sections.map((s) => {
                const on = s.id === active
                return (
                  <button
                    key={s.id}
                    type="button"
                    data-sec={s.id}
                    onClick={() => jump(s.id)}
                    className={cn(
                      'relative flex w-full flex-col items-start gap-1 px-2.5 py-3 text-left text-[13px] leading-tight transition-colors duration-150',
                      on ? 'bg-surface font-semibold text-accent' : 'text-secondary hover:text-ink',
                    )}
                  >
                    {on && (
                      <motion.span
                        layoutId={`menu-sec-bar-${menuId}`}
                        transition={{ type: 'spring', stiffness: 450, damping: 36 }}
                        className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent"
                      />
                    )}
                    {s.badge && (
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-[1px] text-[10px] font-semibold',
                          s.id === '__top' ? 'bg-[var(--mf-role-prep)] text-white' : 'bg-accent-strong text-on-accent',
                        )}
                      >
                        {s.badge}
                      </span>
                    )}
                    <span className="[overflow-wrap:anywhere]">{s.navName ?? s.name}</span>
                  </button>
                )
              })}
            </nav>

            {/* 右侧：分组 + 两列卡片 */}
            <div className="min-w-0 flex-1">
              {sections.length === 0 ? (
                <p className="mf-inset rounded-2xl p-5 text-center text-sm text-secondary">{t('menu.empty')}</p>
              ) : (
                sections.map((s) => (
                  <section key={s.id} id={anchor(s.id)} className="mb-5 scroll-mt-12">
                    <h2 className="mb-2.5 flex items-baseline gap-1.5 pl-0.5 text-[15px] font-bold text-ink">
                      {s.name}
                      <span className="text-xs font-normal text-secondary">{s.dishIds.length}</span>
                    </h2>
                    {s.groups ? (
                      <div className="space-y-3">
                        {s.groups.map((g) => (
                          <div key={g.id}>
                            {g.name && <p className="mb-1.5 pl-0.5 text-xs font-semibold text-secondary">{g.name}</p>}
                            <div className="grid grid-cols-2 gap-2.5">
                              {g.dishIds.map((id) => renderCard(id, `${s.id}-${g.id}-${id}`))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2.5">
                        {s.dishIds.map((id) => renderCard(id, `${s.id}-${id}`))}
                      </div>
                    )}
                  </section>
                ))
              )}
              {/* 末尾留白：让最后一个分组也能滚到顶部，左侧高亮才能跟上 */}
              <div style={{ height: `calc(100dvh - ${TABS_H + BOTTOM_GAP + 220}px)` }} />
              <p className="pb-2 text-center text-[11px] text-secondary/70">{menu?.rule}</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
