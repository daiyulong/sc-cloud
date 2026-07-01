"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { cn } from "@/lib/utils"
import { TableRow } from "@/components/ui/table"

type ClickableRowProps = {
  href: string
  children: React.ReactNode
  className?: string
  /** 软导航是否滚动到顶；打开 ?view 工作区时传 false 以留在原位（默认整页跳转滚顶） */
  scroll?: boolean
}

/**
 * 整行可点击的表格行：点击空白处软导航到 href（整页详情，或 `?view=` 工作区，取决于传入 href）。
 * 键盘/中键/无障碍由行内真实的编号 Link 承担；嵌套交互元素与选中文本不触发行导航。
 */
export function ClickableRow({ href, children, className, scroll = true }: ClickableRowProps) {
  const router = useRouter()

  function onClick(event: React.MouseEvent<HTMLTableRowElement>) {
    const target = event.target as HTMLElement
    if (target.closest("a,button,input,textarea,select,[role='menu'],[role='menuitem'],[role='dialog']")) {
      return
    }
    if (window.getSelection()?.toString()) return
    router.push(href, { scroll })
  }

  return (
    <TableRow className={cn("cursor-pointer", className)} onClick={onClick}>
      {children}
    </TableRow>
  )
}
