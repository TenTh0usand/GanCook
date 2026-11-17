'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * 手机端可靠的原生文件选择器触发器：
 * 用透明 <input type="file"> 直接覆盖在按钮 / 区域上方（不使用 display:none + ref.click()），
 * 确保 Android / iOS Chrome 在 Radix Dialog 弹窗或普通页面里点击都能直接拉起系统拍照 / 相册弹窗。
 */
export function FileTrigger({
  accept,
  capture,
  multiple,
  disabled,
  ariaLabel,
  className,
  onFiles,
  children,
}: {
  accept?: string
  capture?: 'user' | 'environment'
  multiple?: boolean
  disabled?: boolean
  ariaLabel?: string
  className?: string
  onFiles: (files: File[]) => void
  children: React.ReactNode
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 必须在清空 value 前拷贝文件列表：Chromium 清空 value 时会同步清空 live FileList
    const picked = e.target.files ? Array.from(e.target.files) : []
    e.target.value = ''
    if (picked.length > 0) onFiles(picked)
  }

  return (
    <label
      className={cn(
        'relative cursor-pointer select-none',
        disabled && 'pointer-events-none opacity-40',
        className,
      )}
    >
      {children}
      <input
        type="file"
        accept={accept}
        capture={capture}
        multiple={multiple}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={handleChange}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 [&::file-selector-button]:h-full [&::file-selector-button]:w-full [&::file-selector-button]:cursor-pointer [&::file-selector-button]:border-0"
      />
    </label>
  )
}
