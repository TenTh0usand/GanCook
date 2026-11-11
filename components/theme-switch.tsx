'use client'

import { useOptimistic, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Segmented } from '@/components/ui/segmented'
import { useT } from '@/components/i18n-provider'
import { setTheme } from '@/lib/actions/theme'
import { THEME_COLORS, type ThemeName } from '@/lib/theme'

export function ThemeSwitch({
  initialTheme,
  className,
}: {
  initialTheme: ThemeName
  className?: string
}) {
  const t = useT()
  const router = useRouter()
  const [theme, setOptimisticTheme] = useOptimistic(initialTheme)
  const [, startTransition] = useTransition()

  const change = (next: ThemeName) => {
    if (next === theme) return
    // 0ms 即时切换 DOM 属性与浏览器状态栏颜色，无需等服务端往返
    document.documentElement.dataset.theme = next
    document
      .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      .forEach((meta) => {
        const dark = meta.media.includes('dark')
        meta.content = dark ? THEME_COLORS[next].dark : THEME_COLORS[next].light
      })
    startTransition(async () => {
      setOptimisticTheme(next)
      await setTheme(next)
      router.refresh()
    })
  }

  return (
    <Segmented<ThemeName>
      className={className}
      value={theme}
      onChange={change}
      layoutId="theme-switch"
      options={[
        {
          value: 'green',
          label: (
            <span className="inline-flex items-center justify-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#4ea96b] ring-1 ring-black/10" />
              <span>{t('me.themeGreen')}</span>
            </span>
          ),
        },
        {
          value: 'sky',
          label: (
            <span className="inline-flex items-center justify-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#5aa3e8] ring-1 ring-black/10" />
              <span>{t('me.themeSky')}</span>
            </span>
          ),
        },
      ]}
    />
  )
}
