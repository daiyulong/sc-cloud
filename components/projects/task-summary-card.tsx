"use client"

import Link from "next/link"
import {
  EXPERIMENT_TASK_STATUS_LABELS,
  type ExperimentTaskStatus as ExperimentTaskStatusValue,
} from "@/lib/enums"
import { formatDate } from "@/lib/utils"
import { ExperimentTaskActionMenu } from "@/components/experiment-tasks/experiment-task-action-menu"
import { EXPERIMENT_TASK_STATUS_DOT, StatusDot } from "@/components/status-dot"
import { ClickableCard } from "@/components/list/clickable-card"

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
 * 整张卡可点击进入工作项面板（ClickableCard 统一「跳过内部交互 + 键盘可达」）。
 */
export function TaskSummaryCard({ projectId, task, role }: Props) {
  const status = task.status as ExperimentTaskStatusValue
  const viewHref = `/projects/${projectId}?tab=tasks&view=task:${task.id}`

  return (
    <ClickableCard href={viewHref}>
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
    </ClickableCard>
  )
}
