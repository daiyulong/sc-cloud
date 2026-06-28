import Link from "next/link"
import { Edit, Maximize2 } from "lucide-react"
import {
  BIOINFO_TASK_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  type BioinfoTaskStatus as BioinfoTaskStatusValue,
  type ExperimentTaskStatus as ExperimentTaskStatusValue,
  type ProjectStatus as ProjectStatusValue,
} from "@/lib/enums"
import type { getBioinfoTaskDetail } from "@/lib/bioinfo-tasks/service"
import { OperationTimeline } from "@/components/detail/operation-timeline"
import { BioinfoTaskActionMenu } from "@/components/bioinfo-tasks/bioinfo-task-action-menu"
import { BioinfoTaskFields } from "@/components/bioinfo-tasks/bioinfo-task-fields"
import { RunMetricsSection } from "@/components/experiment-tasks/run-metrics-section"
import { pickRunMetrics } from "@/components/experiment-tasks/run-metrics"
import { BIOINFO_TASK_STATUS_DOT, StatusDot } from "@/components/status-dot"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

type BioinfoTaskDetail = Awaited<ReturnType<typeof getBioinfoTaskDetail>>

/** 侧滑详情内容（server 渲染）：头部 + 动作 + 核心字段 + 时间线 */
export function BioinfoTaskSheetBody({
  detail,
  role,
}: {
  detail: BioinfoTaskDetail
  role?: string
}) {
  const { task, operationLogs } = detail
  const status = task.status as BioinfoTaskStatusValue

  return (
    <div className="flex flex-col gap-5 p-6">
      <header className="flex flex-col gap-2 pr-8">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{task.taskNo}</h2>
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <StatusDot className={BIOINFO_TASK_STATUS_DOT[status]} />
            {BIOINFO_TASK_STATUS_LABELS[status]}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/projects/${task.project.id}`} className="hover:underline">
            {task.project.projectNo}
          </Link>{" "}
          · {task.project.customerOrg} ·{" "}
          {PROJECT_STATUS_LABELS[task.project.status as ProjectStatusValue]}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <BioinfoTaskActionMenu
          taskId={task.id}
          taskNo={task.taskNo}
          status={status}
          role={role}
          analysisType={task.analysisType}
          showEmptyHint
        />
        <div className="ml-auto flex items-center gap-1.5">
          {/* 原生 <a> 硬导航绕过拦截，直达全页 */}
          <Button variant="ghost" size="icon-sm" asChild>
            <a href={`/bioinfo-tasks/${task.id}`} aria-label="在全页中打开">
              <Maximize2 aria-hidden="true" />
            </a>
          </Button>
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={`/bioinfo-tasks/${task.id}/edit`} aria-label="编辑生信任务">
              <Edit aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>

      <Separator />
      <BioinfoTaskFields task={task} columns={2} />
      <Separator />
      <RunMetricsSection
        experimentTaskId={task.experimentTask.id}
        taskNo={task.experimentTask.taskNo}
        status={task.experimentTask.status as ExperimentTaskStatusValue}
        role={role}
        metrics={pickRunMetrics(task.experimentTask.taskSamples)}
      />
      <Separator />

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">时间线</h3>
        <OperationTimeline logs={operationLogs} />
      </section>
    </div>
  )
}
