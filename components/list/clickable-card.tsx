"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { cn } from "@/lib/utils"
import { isInteractiveOrSelectionClick } from "@/components/list/click-guard"

type ClickableCardProps = {
  href: string
  children: React.ReactNode
  className?: string
}

/**
 * 整块可点击的卡片：点击空白处软导航到 href（`?view=` 工作区，scroll: false 留在原位）。
 * 行内真实的编号 Link 承担键盘/中键/无障碍；嵌套交互元素与选中文本不触发卡片导航。
 * 与 ClickableRow 同源（共用 click-guard），差异仅在渲染 div 而非 TableRow。
 */
export function ClickableCard({ href, children, className }: ClickableCardProps) {
  const router = useRouter()

  function onClick(event: React.MouseEvent<HTMLDivElement>) {
    if (isInteractiveOrSelectionClick(event.target as HTMLElement)) return
    router.push(href, { scroll: false })
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          router.push(href, { scroll: false })
        }
      }}
      className={cn(
        "flex cursor-pointer items-start justify-between gap-3 rounded-md border bg-background p-4 transition-colors hover:border-primary/40 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      {children}
    </div>
  )
}
