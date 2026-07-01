"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import Link from "next/link"
import {
  EXPERIMENT_TASK_STATUS_LABELS,
  type ExperimentTaskStatus as ExperimentTaskStatusValue,
} from "@/lib/enums"
import { formatDate } from "@/lib/utils"
import { ExperimentTaskActionMenu } from "@/components/experiment-tasks/experiment-task-action-menu"
import { EXPERIMENT_TASK_STATUS_DOT, StatusDot } from "@/components/status-dot"

type Props = {
  projectId: string
  task: {
    id: string
    taskNo: string
    status: string
    experimentType: string | null
    plannedDate: string | Date | null
    operator: { name: string } | null
  }
  role?: string
}

/**
 * 项目页实验任务 Tab 在「本项目 1 个实验任务」时显示的紧凑卡片。
 * 整张卡可点击进入工作项面板（与 ClickableRow 同套跳过内部交互的规则）。
 * 行内 ActionMenu 渲染在右上角，由 closest 选择器过滤。
 */
export function TaskSummaryCard({ projectId, task, role }: Props) {
  const router = useRouter()
  const status = task.status as ExperimentTaskStatusValue
  const viewHref = `/projects/${projectId}?tab=tasks&view=task:${task.id}`

  function onClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    if (
      target.closest(
        "a,button,input,textarea,select,[role='menu'],[role='menuitem'],[role='dialog']",
      )
    ) {
      return
    }
    if (window.getSelection()?.toString()) return
    router.push(viewHref, { scroll: false })
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          router.push(viewHref, { scroll: false })
        }
      }}
      className="flex cursor-pointer items-start justify-between gap-3 rounded-md border bg-background p-4 transition-colors hover:border-primary/40 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={viewHref}
            scroll={false}
            className="font-medium hover:underline"
          >
            {task.taskNo}
          </Link>
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <StatusDot className={EXPERIMENT_TASK_STATUS_DOT[status]} />
            {EXPERIMENT_TASK_STATUS_LABELS[status]}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {[task.experimentType, formatDate(task.plannedDate), task.operator?.name]
            .filter(Boolean)
            .join(" · ") || "—"}
        </p>
      </div>
      <ExperimentTaskActionMenu
        taskId={task.id}
        taskNo={task.taskNo}
        status={status}
        role={role}
        workItemHref={viewHref}
        compact
      />
    </div>
  )
}
