"use client"

import { useRouter, useSearchParams } from "next/navigation"
import * as React from "react"
import { LoaderCircle, Search, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { StatusDot } from "@/components/status-dot"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const ALL = "__all__"
const SEARCH_DEBOUNCE_MS = 300

export type ListToolbarFilter = {
  /** URL 参数名，如 "status" */
  key: string
  /** SelectValue placeholder，如 "项目状态" */
  label: string
  /** 哨兵项文案，如 "全部状态" */
  allLabel: string
  /** dot 为状态彩点的 tailwind 背景色类（可选） */
  options: { value: string; label: string; dot?: string }[]
  /** server 解析后的当前值 */
  value?: string
}

type ListToolbarProps = {
  basePath: string
  searchPlaceholder: string
  searchDefault?: string
  searchKey?: string
  filters?: ListToolbarFilter[]
  /** 上下文 chip（如样本页的项目维度），点 X 删除 clearKeys */
  context?: { label: string; clearKeys: string[] }
  /** 右侧 action 插槽（server 端渲染的新建按钮等） */
  children?: React.ReactNode
}

/**
 * 列表页单行工具栏：搜索输入防抖后即时写 URL，Select 变更立即写 URL。
 * 统一 router.replace（筛选是视图状态，不进浏览器历史）；任何变更重置 page。
 * 注意：依赖 useSearchParams，若所在页面改为静态预渲染需包 <Suspense>。
 */
export function ListToolbar({
  basePath,
  searchPlaceholder,
  searchDefault,
  searchKey = "q",
  filters,
  context,
  children,
}: ListToolbarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = React.useTransition()

  const navigate = React.useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams)
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key)
        else params.set(key, value)
      }
      // 筛选条件变化后回到第 1 页
      params.delete("page")
      const href = params.size ? `${basePath}?${params.toString()}` : basePath
      startTransition(() => router.replace(href, { scroll: false }))
    },
    [basePath, router, searchParams]
  )

  // —— 搜索框：受控 + 非聚焦时跟随 URL（处理浏览器前进/后退回流） ——
  const urlValue = searchParams.get(searchKey) ?? searchDefault ?? ""
  const [value, setValue] = React.useState(urlValue)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    if (document.activeElement !== inputRef.current) setValue(urlValue)
  }, [urlValue])

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const schedule = React.useCallback(
    (next: string) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        navigate({ [searchKey]: next.trim() || null })
      }, SEARCH_DEBOUNCE_MS)
    },
    [navigate, searchKey]
  )

  function onSearchChange(event: React.ChangeEvent<HTMLInputElement>) {
    setValue(event.target.value)
    // IME 组合中（拼音中间态）不触发搜索；compositionEnd 兜底
    if ((event.nativeEvent as InputEvent).isComposing) return
    schedule(event.target.value)
  }

  function onCompositionEnd(event: React.CompositionEvent<HTMLInputElement>) {
    schedule(event.currentTarget.value)
  }

  return (
    <div
      data-pending={isPending ? "" : undefined}
      aria-busy={isPending || undefined}
      className="flex flex-wrap items-center gap-2"
    >
      {context && (
        <Badge variant="outline" className="h-9 gap-1.5 px-3 text-sm font-normal">
          {context.label}
          <button
            type="button"
            aria-label="清除上下文筛选"
            className="-mr-1 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            onClick={() =>
              navigate(Object.fromEntries(context.clearKeys.map((key) => [key, null])))
            }
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </Badge>
      )}
      <div className="relative min-w-[200px] flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          ref={inputRef}
          name={searchKey}
          value={value}
          onChange={onSearchChange}
          onCompositionEnd={onCompositionEnd}
          placeholder={searchPlaceholder}
          spellCheck={false}
          autoComplete="off"
          aria-label={searchPlaceholder}
          className="px-9"
        />
        {isPending && (
          <LoaderCircle
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </div>
      {filters?.map((filter) => (
        <Select
          key={filter.key}
          value={filter.value || ALL}
          onValueChange={(next) => navigate({ [filter.key]: next === ALL ? null : next })}
        >
          <SelectTrigger className="w-[160px]" aria-label={filter.label}>
            <SelectValue placeholder={filter.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value={ALL}>{filter.allLabel}</SelectItem>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.dot && <StatusDot className={`mr-1.5 ${option.dot}`} />}
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      ))}
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  )
}
