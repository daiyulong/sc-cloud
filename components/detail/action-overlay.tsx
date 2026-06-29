"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

/**
 * 动作浮层落点（重构 §4）：
 * - `surface="sheet"` → 右侧抽屉，仅供**列表行**触发的高密度队列动作（登记接收 / 录反馈·质控…），
 *   工位制下「点行→右抽屉→处理→下一条」不丢列表上下文。
 * - `surface="dialog"`（默认）→ 居中 Dialog，供**详情抽屉内部**或全页触发——避免与右侧 ?view 详情抽屉双右浮层叠打。
 * 表单组件用本壳替换原 Dialog/DialogContent，body 不变；动作菜单按调用面下传 surface。
 */
export type ActionSurface = "dialog" | "sheet"

type ActionOverlayProps = {
  surface?: ActionSurface
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode
  /** 透传到内容容器（如 sm:max-w-lg）；与抽屉默认宽度由 twMerge 取后者 */
  className?: string
  children: React.ReactNode
}

export function ActionOverlay({
  surface = "dialog",
  open,
  onOpenChange,
  title,
  description,
  footer,
  className,
  children,
}: ActionOverlayProps) {
  if (surface === "sheet") {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className={cn("w-full sm:max-w-xl", className)}>
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : null}
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4">{children}</div>
          {footer ? <SheetFooter>{footer}</SheetFooter> : null}
        </SheetContent>
      </Sheet>
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  )
}
