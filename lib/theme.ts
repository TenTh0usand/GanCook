export const themes = ['lobe', 'green', 'sky'] as const
export type ThemeName = (typeof themes)[number]
/** 默认配色：Lobe 极简（取自 lobehub/lobe-mygo 的 Lobe UI 设计令牌） */
export const defaultTheme: ThemeName = 'lobe'
export const THEME_COOKIE = 'theme'

export function isTheme(v: string | undefined | null): v is ThemeName {
  return !!v && (themes as readonly string[]).includes(v)
}

/** 解析 Cookie 中的主题值（兼容预览期旧值 milk → sky；未设置时用默认配色） */
export function resolveTheme(v: string | undefined | null): ThemeName {
  if (v === 'milk') return 'sky'
  return isTheme(v) ? v : defaultTheme
}

/** 浏览器状态栏颜色（= 各主题的页面底色） */
export const THEME_COLORS: Record<ThemeName, { light: string; dark: string }> = {
  lobe: { light: '#f8f8f8', dark: '#000000' },
  green: { light: '#f4f6f4', dark: '#15171a' },
  sky: { light: '#f2f7fc', dark: '#131820' },
}

/** 「我的 → 主题配色」里的小预览（固定色，不随当前主题变化） */
export const THEME_PREVIEW: Record<ThemeName, { base: string; surface: string; accent: string; line: string }> = {
  lobe: { base: '#f8f8f8', surface: '#ffffff', accent: '#222222', line: '#e3e3e3' },
  green: { base: '#f4f6f4', surface: '#ffffff', accent: '#4ea96b', line: '#e7f2ea' },
  sky: { base: '#f2f7fc', surface: '#ffffff', accent: '#4a96dc', line: '#e6f2fc' },
}
