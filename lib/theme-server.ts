import 'server-only'
import { cookies } from 'next/headers'
import { THEME_COOKIE, resolveTheme, type ThemeName } from './theme'

export async function getTheme(): Promise<ThemeName> {
  const c = await cookies()
  return resolveTheme(c.get(THEME_COOKIE)?.value)
}
