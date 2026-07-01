"use client"

import * as React from "react"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useCloseWorkItemPanel } from "./use-close-work-item-panel"

type WorkItemPanelProps = {
  title: string
  children: React.ReactNode
  /** 触发工作项面板的查询参数名；关闭即从 URL 移除（默认 view） */
  param?: string
}

/**
 * 查询参数驱动的工作项处理面板。
 * 只提供列表上下文里的单栏承载壳；当前状态下的主任务、表单、摘要由业务 body 决定。
 */
export function WorkItemPanel({
  title,
  children,
  param = "view",
}: WorkItemPanelProps) {
  const close = useCloseWorkItemPanel(param)
  const [open, setOpen] = React.useState(true)

  function dismiss() {
    setOpen(false)
    close()
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss()
      }}
    >
      <SheetContent
        side="right"
        aria-describedby={undefined}
        className="w-full max-w-none gap-0 overflow-hidden overscroll-contain p-0 sm:w-[min(880px,calc(100vw-72px))] sm:max-w-none"
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <div className="flex h-full min-h-0 flex-col">{children}</div>
      </SheetContent>
    </Sheet>
  )
}

export function WorkItemPanelEmpty({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
