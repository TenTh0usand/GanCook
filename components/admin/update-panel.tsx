'use client'

import { ExternalLink, Terminal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useT } from '@/components/i18n-provider'

export function UpdatePanel({
  current,
  repoUrl,
}: {
  current: string
  repoUrl: string
}) {
  const t = useT()

  return (
    <div className="mf-raised space-y-4 p-4">
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-medium text-ink">{t('update.current')}</p>
          <p className="mt-0.5 font-mono text-sm text-secondary">{current}</p>
          <p className="mt-1 text-xs text-secondary">{t('update.edition')}</p>
        </div>
        <Badge tone="accent" className="shrink-0 whitespace-nowrap">
          {t('update.editionBadge')}
        </Badge>
      </div>

      <div className="relative space-y-2 border-t border-black/[0.04] pt-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <Terminal className="h-4 w-4" />
          {t('update.opsTitle')}
        </p>
        <p className="text-xs text-secondary">{t('update.opsHint')}</p>
        <pre className="overflow-x-auto rounded-xl mf-inset p-3 text-xs leading-relaxed text-ink">
          <code>{`./manage.sh status         # 查看开发(4257) / 正式(4258)状态
./manage.sh deploy         # 备份数据 + 构建并发布到正式版
./manage.sh backup         # 单独备份正式版数据库与图片
./manage.sh rollback-prod  # 正式版一键回滚到上一版镜像`}</code>
        </pre>
        <a
          href={repoUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
        >
          {t('update.repo')}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  )
}
