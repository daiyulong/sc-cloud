import * as React from "react"

/**
 * 工作项「主动作」面板外壳：muted 底 + 图标标题 + 「taskNo · 说明」副行 + body。
 * 各工位（实验 / 生信）主动作区共用同一外壳，body（各状态表单/按钮）仍各工位独立。
 * 与 WorkItemHeader / EditableSection / useEntityAction 一样收口到 components/detail/。
 */
export function ActionPanel({
  icon,
  title,
  taskNo,
  description,
  children,
}: {
  icon: React.ReactNode
  title: React.ReactNode
  taskNo: string
  description: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-md bg-muted/30 p-4">
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium">
            {icon}
            {title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {taskNo} · {description}
          </p>
        </div>
        {children}
      </div>
    </section>
  )
}
