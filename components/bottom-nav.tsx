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

// GanCook-10k锛氭柊澧炪€屽鑿溿€嶏紝銆岃础鐚€嶆敼涓恒€岀粺璁°€嶏紱6 涓?Tab锛屾瘡涓?52px锛堝皬灞忎篃鏀惧緱涓嬶級
const TABS = [
  { href: '/home', key: 'nav.home', icon: Home },
  { href: '/meals', key: 'nav.meals', icon: UtensilsCrossed },
  { href: '/prep', key: 'nav.prep', icon: ShoppingBasket },
  { href: '/dishes', key: 'nav.dishes', icon: ChefHat },
  { href: '/stats', key: 'nav.stats', icon: BarChart3 },
  { href: '/me', key: 'nav.me', icon: User },
] as const

/** 娴姩搴曢儴 Tab Bar锛氬井纾ㄧ爞鍑规Ы + 閫変腑椤圭櫧鑹叉诞璧?bump锛坙ayoutId 寮规€ф粦鍔級 */
export function BottomNav() {
  const pathname = usePathname()
  const t = useT()
  // GanCook-10k锛氬叏灞忕偣鑿滈〉鐢ㄣ€屽凡鐐?N 閬撱€嶆爮浠ｆ浛搴曢儴瀵艰埅
  if (/^\/meals\/[^/]+\/order/.test(pathname)) return null
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[calc(env(safe-area-inset-bottom)+12px)]">
      <div className="pointer-events-auto flex rounded-[var(--radius-dock)] items-center gap-1 border border-black/[0.06] bg-trough/90 p-1.5 shadow-[0_6px_24px_rgb(var(--mf-shadow)/0.16)] backdrop-blur-md dark:border-white/[0.07]">
        {TABS.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(tab.href + '/')
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'relative flex h-12 w-[52px] flex-col items-center justify-center gap-0.5 rounded-[calc(var(--radius-dock)-6px)] text-[11px] font-medium transition-[color,transform] duration-150 active:scale-95',
                active ? 'text-accent' : 'text-secondary hover:text-ink',
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-bump"
                  className="mf-bump absolute inset-0 rounded-[calc(var(--radius-dock)-6px)]"
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
