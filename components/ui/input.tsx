import * as React from 'react'
import { cn } from '@/lib/utils'

/** 凹陷输入框（trough fill + 顶部内阴影），聚焦时轻柔浮起为白布面并叠青菜绿柔光描边 */
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        'mf-inset h-11 w-full px-4 text-[15px] text-ink outline-none placeholder:text-secondary/70',
        className,
      )}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        'mf-inset min-h-[88px] w-full px-4 py-3 text-[15px] text-ink outline-none placeholder:text-secondary/70',
        className,
      )}
      {...props}
    />
  )
})
Textarea.displayName = 'Textarea'
