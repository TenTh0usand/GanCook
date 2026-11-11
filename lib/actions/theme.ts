'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { THEME_COOKIE, isTheme } from '@/lib/theme'

export async function setTheme(theme: string) {
  if (!isTheme(theme)) return
  const c = await cookies()
  c.set(THEME_COOKIE, theme, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  revalidatePath('/', 'layout')
}
