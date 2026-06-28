"use client"

import { usePathname } from "next/navigation"
import { resolvePageTitle } from "@/components/nav-items"

/** 顶栏页面标题：按路径解析当前导航项 / 详情路由标题 */
export function PageTitle() {
  const pathname = usePathname()
  const title = resolvePageTitle(pathname)
  if (!title) return null
  return <span className="truncate text-sm font-medium">{title}</span>
}
