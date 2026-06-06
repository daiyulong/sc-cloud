"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { cn } from "@/lib/utils"
import { TableRow } from "@/components/ui/table"

type ClickableRowProps = {
  href: string
  children: React.ReactNode
  className?: string
}

/**
 * 整行可点击的表格行：点击空白处软导航（被 @sheet 拦截开侧滑）。
 * 键盘/中键/无障碍由行内真实的编号 Link 承担；嵌套交互元素与选中文本不触发行导航。
 */
export function ClickableRow({ href, children, className }: ClickableRowProps) {
  const router = useRouter()

  function onClick(event: React.MouseEvent<HTMLTableRowElement>) {
    const target = event.target as HTMLElement
    if (target.closest("a,button,input,textarea,select,[role='menu'],[role='menuitem'],[role='dialog']")) {
      return
    }
    if (window.getSelection()?.toString()) return
    router.push(href)
  }

  return (
    <TableRow className={cn("cursor-pointer", className)} onClick={onClick}>
      {children}
    </TableRow>
  )
}
