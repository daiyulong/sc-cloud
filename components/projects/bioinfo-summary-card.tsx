"use client"

import Link from "next/link"
import {
  BIOINFO_TASK_STATUS_LABELS,
  type BioinfoTaskStatus as BioinfoTaskStatusValue,
} from "@/lib/enums"
import { BioinfoTaskActionMenu } from "@/components/bioinfo-tasks/bioinfo-task-action-menu"
import { BIOINFO_TASK_STATUS_DOT, StatusDot } from "@/components/status-dot"
import { ClickableCard } from "@/components/list/clickable-card"

type Props = {
  projectId: string
  task: {
    id: string
    taskNo: string
    status: string
    analysisType: string | null
    experimentTask: { id: string; taskNo: string }
    analyst: { name: string } | null
  }
  role?: string
}

/**
 * 项目页生信 Tab 在「本项目 1 个生信任务」时显示的紧凑卡片。
 * 与 TaskSummaryCard 同套：ClickableCard 统一「整张卡可点击、跳过内部交互、键盘可达」。
 */
export function BioinfoSummaryCard({ projectId, task, role }: Props) {
  const status = task.status as BioinfoTaskStatusValue
  const viewHref = `/projects/${projectId}?tab=bioinfo&view=bioinfo:${task.id}`

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
            <StatusDot className={BIOINFO_TASK_STATUS_DOT[status]} />
            {BIOINFO_TASK_STATUS_LABELS[status]}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {[task.analysisType, task.experimentTask.taskNo, task.analyst?.name]
            .filter(Boolean)
            .join(" · ") || "—"}
        </p>
      </div>
      <BioinfoTaskActionMenu
        taskId={task.id}
        taskNo={task.taskNo}
        status={status}
        role={role}
        analysisType={task.analysisType}
        compact
      />
    </ClickableCard>
  )
}
