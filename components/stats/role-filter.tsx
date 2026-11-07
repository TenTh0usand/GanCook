'use client'

import * as React from 'react'
import { Check, Plus } from 'lucide-react'
import { useT } from '@/components/i18n-provider'
import {
  CONTRIB_KINDS,
  DEFAULT_VISIBLE,
  ROLE_META,
  roleTint,
  type ContribKind,
} from '@/lib/roles'

/**
 * 统计页「家务贡献」的显示筛选（GanCook-10k）。
 * 默认只显示 做菜 / 点菜；用户的选择记在本设备 localStorage。
 * 热力图本身在服务端渲染，这里只负责显示 / 隐藏。
 */
const STORAGE_KEY = 'gancook.stats.visibleKinds'

const Ctx = React.createContext<{
  visible: ContribKind[]
  toggle: (k: ContribKind) => void
}>({ visible: DEFAULT_VISIBLE, toggle: () => {} })

export function RoleFilterProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = React.useState<ContribKind[]>(DEFAULT_VISIBLE)

  React.useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
      if (Array.isArray(saved)) {
        const valid = saved.filter((k): k is ContribKind =>
          (CONTRIB_KINDS as readonly string[]).includes(k),
        )
        if (valid.length > 0) setVisible(valid)
      }
    } catch {
      // 读不到就用默认，不打扰用户
    }
  }, [])

  const toggle = React.useCallback((k: ContribKind) => {
    setVisible((prev) => {
      const next = prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]
      // 至少保留一种，避免整页空白
      const safe = next.length > 0 ? next : prev
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(safe))
      } catch {}
      return safe
    })
  }, [])

  return <Ctx.Provider value={{ visible, toggle }}>{children}</Ctx.Provider>
}

/** 顶部四个胶囊：已显示 = 角色色淡底 + ✓；隐藏 = 虚线框 + ＋ */
export function RoleFilterBar() {
  const t = useT()
  const { visible, toggle } = React.useContext(Ctx)
  return (
    <div className="mb-4">
      <div className="flex flex-wrap gap-2">
        {CONTRIB_KINDS.map((k) => {
          const on = visible.includes(k)
          const meta = ROLE_META[k]
          return (
            <button
              key={k}
              type="button"
              onClick={() => toggle(k)}
              aria-pressed={on}
              className="mf-pressable inline-flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-medium"
              style={
                on
                  ? { background: roleTint(k), color: meta.color }
                  : {
                      border: '1px dashed rgba(var(--mf-shadow) / 0.35)',
                      color: 'var(--mf-secondary)',
                    }
              }
            >
              {on ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {t(meta.labelKey)}
            </button>
          )
        })}
      </div>
      <p className="mt-2 pl-1 text-xs text-secondary">{t('stats.filterHint')}</p>
    </div>
  )
}

/** 只有当该角色处于显示状态时才渲染子内容 */
export function RoleVisible({
  kind,
  children,
}: {
  kind: ContribKind
  children: React.ReactNode
}) {
  const { visible } = React.useContext(Ctx)
  if (!visible.includes(kind)) return null
  return <>{children}</>
}
