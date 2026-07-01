"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export type ListTabsItem<V extends string> = {
  value: V
  label: string
  /** Tab 上可选的数量徽章 */
  count?: number
}

export type ListTabsProps<V extends string> = {
  basePath: string
  items: ListTabsItem<V>[]
  /** 当前值(由调用方从 URL 解析后传入);缺省 = items[0].value */
  value?: V | null
  /** URL 查询参数 key;默认 "tab" */
  searchKey?: string
  /** 切换 Tab 时保留的其余 URL 参数(过滤、scope、分页等);首项/默认值不写 searchKey */
  extraSearchParams?: URLSearchParams
  className?: string
}

/**
 * URL 绑定的状态 Tab 行(无 TabsContent)。状态 Tab 表达「走到哪一步」,
 * 与 scope 控件、ListToolbar 等同级段平铺使用。首项/默认值不写 searchKey,
 * 切 Tab 时保留其余 URL 参数。
 */
export function ListTabs<V extends string>({
  basePath,
  items,
  value,
  searchKey = "tab",
  extraSearchParams,
  className,
}: ListTabsProps<V>) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const effectiveValue = (value ?? items[0]?.value) as string | undefined

  function hrefFor(nextValue: string): string {
    const params = new URLSearchParams(
      extraSearchParams?.toString() ?? searchParams.toString(),
    )
    const isDefault = nextValue === items[0]?.value
    if (isDefault) params.delete(searchKey)
    else params.set(searchKey, nextValue)
    params.delete("page")
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  function onValueChange(next: string) {
    router.replace(hrefFor(next), { scroll: false })
  }

  if (!effectiveValue) return null

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

