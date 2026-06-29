"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { PageTitle } from "@/components/page-title"

export type BreadcrumbItem = { label: string; href?: string }

const Ctx = React.createContext<{
  items: BreadcrumbItem[] | null
  setItems: (items: BreadcrumbItem[] | null) => void
} | null>(null)

/** 顶栏面包屑上下文：全页详情/表单设置、顶栏 HeaderTitle 读取（见 ADR-0002）。 */
export function DetailBreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<BreadcrumbItem[] | null>(null)
  const value = React.useMemo(() => ({ items, setItems }), [items])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** 顶栏标题：有面包屑则显示「a / b / 当前」（前几段可点回退），否则回退到当前导航段标题。 */
export function HeaderTitle() {
  const items = React.useContext(Ctx)?.items
  if (!items || items.length === 0) return <PageTitle />
  return (
    <nav aria-label="面包屑" className="flex min-w-0 items-center gap-1.5 text-sm">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
          )}
          {item.href ? (
            <Link
              href={item.href}
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ) : (
            <span className="truncate font-medium">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}

/**
 * 全页详情/表单用：把面包屑送进顶栏（挂载设置、卸载清除），自身不渲染可见内容。
 * 放在页面正文顶部即可（不占位）；末段无 href = 当前页。
 */
export function SetBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const setItems = React.useContext(Ctx)?.setItems
  const key = JSON.stringify(items)
  React.useEffect(() => {
    setItems?.(JSON.parse(key) as BreadcrumbItem[])
    return () => setItems?.(null)
  }, [setItems, key])
  return null
}
