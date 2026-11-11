'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Home,
  UtensilsCrossed,
  ShoppingBasket,
  ChefHat,
  BarChart3,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/components/i18n-provider'

// GanCook-10k：新增「备菜」，「贡献」改为「统计」；6 个 Tab，每个 52px（小屏也放得下）
const TABS = [
  { href: '/home', key: 'nav.home', icon: Home },
  { href: '/meals', key: 'nav.meals', icon: UtensilsCrossed },
  { href: '/prep', key: 'nav.prep', icon: ShoppingBasket },
  { href: '/dishes', key: 'nav.dishes', icon: ChefHat },
  { href: '/stats', key: 'nav.stats', icon: BarChart3 },
  { href: '/me', key: 'nav.me', icon: User },
] as const

/** 浮动底部 Tab Bar：微磨砂凹槽 + 选中项白色浮起 bump（layoutId 弹性滑动） */
export function BottomNav() {
  const pathname = usePathname()
  const t = useT()
  // GanCook-10k：全屏点菜页用「已点 N 道」栏代替底部导航
  if (/^\/meals\/[^/]+\/order/.test(pathname)) return null
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[calc(env(safe-area-inset-bottom)+12px)]">
      <div className="mf-trough pointer-events-auto flex items-center gap-1 border border-black/[0.06] bg-trough/90 p-1.5 shadow-[0_6px_24px_rgba(56,71,60,0.16)] backdrop-blur-md dark:border-white/[0.07]">
        {TABS.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(tab.href + '/')
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'relative flex h-12 w-[52px] flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium transition-[color,transform] duration-150 active:scale-95',
                active ? 'text-accent' : 'text-secondary hover:text-ink',
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-bump"
                  className="mf-bump absolute inset-0 rounded-full"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
              <Icon
                className={cn(
                  'relative z-10 h-5 w-5 transition-transform duration-200 ease-out',
                  active && '-translate-y-[1px] scale-105',
                )}
              />
              <span className="relative z-10">{t(tab.key)}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
