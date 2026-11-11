export const themes = ['green', 'sky'] as const
export type ThemeName = (typeof themes)[number]
export const defaultTheme: ThemeName = 'green'
export const THEME_COOKIE = 'theme'

export function isTheme(v: string | undefined | null): v is ThemeName {
  return !!v && (themes as readonly string[]).includes(v)
}

/** 解析 Cookie 中的主题值（兼容预览期旧值 milk 自动平滑切到浅蓝色 sky） */
export function resolveTheme(v: string | undefined | null): ThemeName {
  if (v === 'sky' || v === 'milk') return 'sky'
  return defaultTheme
}

export const THEME_COLORS: Record<ThemeName, { light: string; dark: string }> = {
  green: { light: '#f4f6f4', dark: '#15171a' },
  sky: { light: '#f2f7fc', dark: '#131820' },
}
