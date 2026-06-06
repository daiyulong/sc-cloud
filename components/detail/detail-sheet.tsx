"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

type DetailSheetProps = {
  /** 无障碍标题（可视标题由 children 渲染） */
  title: string
  children: React.ReactNode
}

/**
 * 拦截路由的侧滑详情容器。关闭（ESC/遮罩/X）→ router.back() 回列表。
 * 前提：拦截只在应用内软导航时触发，必有前史，back 安全。
 */
export function DetailSheet({ title, children }: DetailSheetProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(true)

  function onOpenChange(next: boolean) {
    if (!next) {
      setOpen(false)
      router.back()
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetTitle className="sr-only">{title}</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  )
}

/** 侧滑内的取数失败空态（不冒泡 notFound，避免炸整屏） */
export function DetailSheetEmpty({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
