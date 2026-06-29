"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import * as React from "react"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

type DetailSheetProps = {
  /** 无障碍标题（可视标题由 children 渲染） */
  title: string
  children: React.ReactNode
  /** 触发抽屉的查询参数名；关闭即从 URL 移除（默认 view） */
  param?: string
}

/**
 * 查询参数驱动的侧滑详情容器（2026-06 取代旧拦截路由方案，见 ADR-0002）。
 * 由列表页在 `?<param>=<id>` 存在时渲染；关闭（ESC/遮罩/X）→ 从 URL 删除该参数回列表。
 */
export function DetailSheet({ title, children, param = "view" }: DetailSheetProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = React.useState(true)

  function close() {
    setOpen(false)
    const sp = new URLSearchParams(searchParams)
    sp.delete(param)
    const qs = sp.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
      }}
    >
      {/* 详情正文即内容本身，无独立描述；显式置空以消除 Radix 警告 */}
      <SheetContent
        side="right"
        aria-describedby={undefined}
        className="w-full gap-0 overflow-y-auto sm:max-w-xl"
      >
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
