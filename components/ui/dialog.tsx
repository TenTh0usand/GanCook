'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    title?: string
  }
>(({ className, children, title, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="mf-overlay fixed inset-0 z-50 bg-black/35" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'mf-sheet fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88dvh] max-w-md overflow-y-auto rounded-t-[calc(var(--radius)+4px)] bg-base p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-[var(--mf-elev-3)] outline-none',
        'sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-[calc(var(--radius)+4px)]',
        className,
      )}
      {...props}
    >
      <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-trough sm:hidden" />
      {title && (
        <DialogPrimitive.Title className="mb-4 pr-7 text-lg font-semibold tracking-title text-ink">
          {title}
        </DialogPrimitive.Title>
      )}
      {children}
      <DialogPrimitive.Close className="mf-pressable absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-secondary hover:bg-trough hover:text-ink">
        <X className="h-4.5 w-4.5" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DialogContent.displayName = 'DialogContent'
