"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import Link from "next/link"
import {
  BIOINFO_TASK_STATUS_LABELS,
  type BioinfoTaskStatus as BioinfoTaskStatusValue,
} from "@/lib/enums"
import { BioinfoTaskActionMenu } from "@/components/bioinfo-tasks/bioinfo-task-action-menu"
import { BIOINFO_TASK_STATUS_DOT, StatusDot } from "@/components/status-dot"

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
 * 与 TaskSummaryCard 同套：「整张卡可点击、跳过内部交互、键盘可达」。
 */
export function BioinfoSummaryCard({ projectId, task, role }: Props) {
  const router = useRouter()
  const status = task.status as BioinfoTaskStatusValue
  const viewHref = `/projects/${projectId}?tab=bioinfo&view=bioinfo:${task.id}`

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
    </div>
  )
}
