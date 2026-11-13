'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { useT } from '@/components/i18n-provider'
import { setTheme } from '@/lib/actions/theme'
import { THEME_COLORS, THEME_PREVIEW, themes, type ThemeName } from '@/lib/theme'
import { cn } from '@/lib/utils'

const LABEL_KEY: Record<ThemeName, string> = {
  lobe: 'me.themeLobe',
  green: 'me.themeGreen',
  sky: 'me.themeSky',
}

/** 0ms 即时切换 DOM 属性与浏览器状态栏颜色，无需等服务端往返 */
function applyThemeToDocument(next: ThemeName) {
  document.documentElement.setAttribute('data-theme', next)
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((meta) => {
      const dark = meta.media.includes('dark')
      meta.setAttribute('content', dark ? THEME_COLORS[next].dark : THEME_COLORS[next].light)
    })
}

/** 主题配色选择：三张迷你预览卡（点一下 0ms 切换，后台写 Cookie 记住） */
export function ThemeSwitch({ initialTheme }: { initialTheme: ThemeName }) {
  const t = useT()
  // 本地状态为准：连续快速切换时不会被尚未刷新的服务端旧值「弹回去」
  const [theme, setLocalTheme] = useState<ThemeName>(initialTheme)

  const change = (next: ThemeName) => {
    if (next === theme) return
    setLocalTheme(next)
    applyThemeToDocument(next)
    // Server Action 内已 revalidatePath('/', 'layout')，无需再 router.refresh()
    void setTheme(next)
  }

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {themes.map((name) => {
        const p = THEME_PREVIEW[name]
        const active = name === theme
        return (
          <button
            key={name}
            type="button"
            aria-pressed={active}
            onClick={() => change(name)}
            className={cn(
              'mf-pressable group flex flex-col items-center gap-2 rounded-[var(--radius-field)] p-1.5 pb-2 text-[13px] font-medium',
              active ? 'text-ink' : 'text-secondary',
            )}
          >
            <span
              className={cn(
                'relative block h-16 w-full overflow-hidden rounded-[calc(var(--radius-field)*0.75)] transition-shadow duration-200',
                active
                  ? 'shadow-[0_0_0_2px_var(--mf-accent)]'
                  : 'shadow-[0_0_0_1px_var(--mf-hairline-strong)]',
              )}
              style={{ background: p.base }}
            >
              <span
                className="absolute inset-x-2 top-2 h-7 rounded-md"
                style={{ background: p.surface, boxShadow: `0 0 0 1px ${p.line}` }}
              >
                <span className="absolute left-1.5 top-1.5 h-1.5 w-8 rounded-full" style={{ background: p.line }} />
                <span className="absolute bottom-1.5 left-1.5 h-1.5 w-5 rounded-full" style={{ background: p.line }} />
              </span>
              <span
                className="absolute bottom-2 right-2 h-3.5 w-9 rounded-full"
                style={{ background: p.accent }}
              />
              {active && (
                <span
                  className="absolute bottom-1.5 left-2 flex h-4 w-4 items-center justify-center rounded-full"
                  style={{ background: p.accent }}
                >
                  <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                </span>
              )}
            </span>
            <span className="whitespace-nowrap">{t(LABEL_KEY[name])}</span>
          </button>
        )
      })}
    </div>
  )
}
