import * as React from "react"
import { cn } from "@/lib/utils"

/** 详情视图的「标签 + 值」行，值为空时显示 - */
export function FieldLine({
  label,
  value,
  multiline = false,
  className,
}: {
  label: string
  value: React.ReactNode
  multiline?: boolean
  className?: string
}) {
  const containerClass = multiline
    ? "flex min-h-[3.5rem] min-w-0 flex-col gap-1 px-2 py-1.5"
    : "flex h-14 min-w-0 flex-col gap-1 px-2 py-1.5"
  const valueClass = multiline ? "line-clamp-3 break-words text-sm" : "truncate text-sm"

  return (
    <div className={cn(containerClass, className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={valueClass}>{value || "-"}</span>
    </div>
  )
}
