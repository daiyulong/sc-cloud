"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export type ListScopeValue = "mine" | "team"

export type ListScopeToggleProps = {
  basePath: string
  /** 默认 "scope" */
  searchKey?: string
  /** 选择项 label;默认 "我的 / 团队" */
  items?: { value: ListScopeValue; label: string }[]
  /** 角色默认 scope 值(由调用方根据 role 决定) */
  defaultValue?: ListScopeValue
  /** 切 scope 时保留的其余 URL 参数 */
  extraSearchParams?: URLSearchParams
  className?: string
}

const DEFAULT_ITEMS: { value: ListScopeValue; label: string }[] = [
  { value: "mine", label: "我的" },
  { value: "team", label: "团队" },
]

/**
 * URL 绑定的 scope 切换控件(my / team 二段)。与状态 Tab 维度正交:
 * Tab 控 status,本控件控 scope。默认值不写 searchKey。
 */
export function ListScopeToggle({
  basePath,
  searchKey = "scope",
  items = DEFAULT_ITEMS,
  defaultValue = "mine",
  extraSearchParams,
  className,
}: ListScopeToggleProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const raw = searchParams.get(searchKey) as ListScopeValue | null
  const current: ListScopeValue =
    raw === "mine" || raw === "team" ? raw : defaultValue

  function hrefFor(nextValue: ListScopeValue): string {
    const params = new URLSearchParams(
      extraSearchParams?.toString() ?? searchParams.toString(),
    )
    if (nextValue === defaultValue) params.delete(searchKey)
    else params.set(searchKey, nextValue)
    params.delete("page")
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  function onClick(next: ListScopeValue) {
    if (next === current) return
    router.replace(hrefFor(next), { scroll: false })
  }

  return (
    <div
      role="group"
      aria-label="范围切换"
      className={cn("inline-flex items-center gap-1 rounded-md border bg-background p-0.5", className)}
    >
      {items.map((item) => {
        const active = item.value === current
        return (
          <Button
            key={item.value}
            type="button"
            size="sm"
            variant={active ? "default" : "ghost"}
            aria-pressed={active}
            onClick={() => onClick(item.value)}
            className="h-7 px-3 text-xs"
          >
            {item.label}
          </Button>
        )
      })}
    </div>
  )
}
