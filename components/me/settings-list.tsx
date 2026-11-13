'use client'

import { useState, useTransition } from 'react'
import { Palette, Languages, KeyRound, Settings, LogOut } from 'lucide-react'
import { List, Row } from '@/components/ui/list'
import { IconChip } from '@/components/ui/icon-chip'
import { LanguageSwitch } from '@/components/language-switch'
import { ThemeSwitch } from '@/components/theme-switch'
import { ChangePassword } from '@/components/me/change-password'
import { useT } from '@/components/i18n-provider'
import { logout } from '@/lib/actions/auth'
import type { ThemeName } from '@/lib/theme'

export function SettingsList({
  isAdmin,
  theme,
}: {
  isAdmin: boolean
  theme: ThemeName
}) {
  const t = useT()
  const [pwOpen, setPwOpen] = useState(false)
  const [, startTransition] = useTransition()

  return (
    <>
      <List className="mb-4">
        <Row
          leading={
            <IconChip>
              <Palette />
            </IconChip>
          }
          title={t('me.theme')}
          subtitle={t('me.themeHint')}
          chevron={false}
        />
        <div className="px-3 pb-3">
          <ThemeSwitch initialTheme={theme} />
        </div>
      </List>
      <List>
        <Row
          leading={
            <IconChip>
              <Languages />
            </IconChip>
          }
          title={t('me.language')}
          trailing={<LanguageSwitch className="w-[136px]" />}
          chevron={false}
        />
        <Row
          leading={
            <IconChip>
              <KeyRound />
            </IconChip>
          }
          title={t('me.changePassword')}
          onClick={() => setPwOpen(true)}
        />
        {isAdmin && (
          <Row
            leading={
              <IconChip>
                <Settings />
              </IconChip>
            }
            title={t('me.familyAdmin')}
            href="/admin"
          />
        )}
        <Row
          leading={
            <IconChip tone="danger">
              <LogOut />
            </IconChip>
          }
          title={<span className="text-danger">{t('me.logout')}</span>}
          onClick={() => startTransition(() => void logout())}
          chevron={false}
        />
      </List>

      <ChangePassword open={pwOpen} onOpenChange={setPwOpen} />
    </>
  )
}
