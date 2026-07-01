"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export type ListTabsItem<V extends string> = {
  value: V
  label: React.ReactNode
  /** Tab 上可选的数量徽章 */
  count?: number
  /**
   * 显式 href，跳过内部按 searchKey 计算 href 的逻辑。
   * 用于一行 Tabs 里混入"导航到不同 query key/路径"的项
   * （如状态 Tab 之外混入一个跳到 ?mode=schedule 的项，
   * 二者共享同一视觉行但不共享同一个 query key）。
   */
  href?: string
}

export type ListTabsProps<V extends string> = {
  basePath: string
  items: ListTabsItem<V>[]
  /** 当前值(由调用方从 URL 解析后传入);缺省 = defaultValue ?? items[0].value */
  value?: V | null
  /**
   * URL 无 searchKey 参数时对应的值(不写参的那个值)。
   * 缺省 = items[0].value —— 注意：若页面的实际默认值(如角色驱动的默认 tab)
   * 不是数组第一项，必须显式传入，否则切到"第一项"时会被错误地当成"清空参数"，
   * 导致落地页反而不是第一项(页面按 parseXxx(undefined) 解析出的另一个默认值)。
   */
  defaultValue?: V
  /** URL 查询参数 key;默认 "tab" */
  searchKey?: string
  /** 切换 Tab 时保留的其余 URL 参数(过滤、scope、分页等);首项/默认值不写 searchKey */
  extraSearchParams?: URLSearchParams
  className?: string
}

/**
 * URL 绑定的状态 Tab 行(无 TabsContent)。状态 Tab 表达「走到哪一步」,
 * 与 scope 控件、ListToolbar 等同级段平铺使用。默认值(见 defaultValue)不写 searchKey,
 * 切 Tab 时保留其余 URL 参数。
 */
export function ListTabs<V extends string>({
  basePath,
  items,
  value,
  defaultValue,
  searchKey = "tab",
  extraSearchParams,
  className,
}: ListTabsProps<V>) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resolvedDefault = (defaultValue ?? items[0]?.value) as string | undefined
  // value 未传(undefined) → 用默认值；value 显式传 null → 不高亮任何一项
  // (调用方正处于与本 Tab 组正交的另一个模式，此时没有哪个状态算"当前选中");
  // value 传具体值 → 高亮它。用 "" 兜底 null，因为它不会匹配任何 item.value。
  const effectiveValue = value === undefined ? resolvedDefault : (value ?? "")

  function hrefFor(nextValue: string): string {
    const explicitHref = items.find((item) => item.value === nextValue)?.href
    if (explicitHref) return explicitHref
    const params = new URLSearchParams(
      extraSearchParams?.toString() ?? searchParams.toString(),
    )
    const isDefault = nextValue === resolvedDefault
    if (isDefault) params.delete(searchKey)
    else params.set(searchKey, nextValue)
    params.delete("page")
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  function onValueChange(next: string) {
    router.replace(hrefFor(next), { scroll: false })
  }

  if (items.length === 0) return null

  return (
    <Tabs
      value={effectiveValue}
      onValueChange={onValueChange}
      className={cn("w-full overflow-x-auto", className)}
    >
      <TabsList variant="line">
        {items.map((item) => (
          <TabsTrigger key={item.value} value={item.value}>
            {item.label}
            {typeof item.count === "number" && (
              <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                {item.count}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

