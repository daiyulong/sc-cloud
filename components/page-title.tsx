"use client"

import { usePathname } from "next/navigation"
import { matchNavItem } from "@/components/nav-items"

/** 顶栏页面标题：按路径前缀匹配当前导航项 */
export function PageTitle() {
  const pathname = usePathname()
  const item = matchNavItem(pathname)
  if (!item) return null
  return <span className="truncate text-sm font-medium">{item.title}</span>
}
