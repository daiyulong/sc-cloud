import * as React from "react"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

type ListEmptyProps = {
  icon: React.ReactNode
  title: string
  description?: string
  /** 动作按钮（页面侧完成权限判断后传入） */
  children?: React.ReactNode
}

/** 列表页空状态：整体替换表格容器使用，动作引导随场景由页面传入 */
export function ListEmpty({ icon, title, description, children }: ListEmptyProps) {
  return (
    <Empty className="min-h-[320px] border">
      <EmptyHeader>
        <EmptyMedia variant="icon" aria-hidden="true">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {children && (
        <EmptyContent>
          <div className="flex flex-wrap items-center justify-center gap-2">{children}</div>
        </EmptyContent>
      )}
    </Empty>
  )
}
