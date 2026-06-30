import Link from "next/link"
import { Edit, Maximize2 } from "lucide-react"
import {
  BIOINFO_SERVICE_LEVELS,
  EXPERIMENT_TASK_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  type ExperimentTaskStatus as ExperimentTaskStatusValue,
  type ProjectStatus as ProjectStatusValue,
  type ServiceLevel as ServiceLevelValue,
} from "@/lib/enums"
import type { getExperimentTaskDetail } from "@/lib/experiment-tasks/service"
import { OperationTimeline } from "@/components/detail/operation-timeline"
import { ExperimentTaskActionMenu } from "@/components/experiment-tasks/experiment-task-action-menu"
import { ExperimentTaskFields } from "@/components/experiment-tasks/experiment-task-fields"
import { QcSection } from "@/components/experiment-tasks/qc-section"
import { RunMetricsSection } from "@/components/experiment-tasks/run-metrics-section"
import { pickRunMetrics } from "@/components/experiment-tasks/run-metrics"
import { UploadRecordButton } from "@/components/experiment-records/upload-record-button"
import { canUploadRecord } from "@/lib/experiment-records/permissions"
import type { OperatorOption } from "@/components/experiment-tasks/schedule-dialog"
import type { FeedbackAnalystOption } from "@/components/experiment-tasks/feedback-dialog"
import { EXPERIMENT_TASK_STATUS_DOT, StatusDot } from "@/components/status-dot"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

type ExperimentTaskDetail = Awaited<ReturnType<typeof getExperimentTaskDetail>>

/** 侧滑详情内容（server 渲染）：头部 + 动作 + 核心字段 + 质控 + 时间线 */
export function ExperimentTaskSheetBody({
  detail,
  role,
  operatorOptions,
  analystOptions,
}: {
  detail: ExperimentTaskDetail
  role?: string
  operatorOptions: OperatorOption[]
  analystOptions: FeedbackAnalystOption[]
}) {
  const { task, operationLogs } = detail
  const status = task.status as ExperimentTaskStatusValue

  return (
    <div className="flex flex-col gap-5 p-6">
      <header className="flex flex-col gap-2 pr-8">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{task.taskNo}</h2>
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <StatusDot className={EXPERIMENT_TASK_STATUS_DOT[status]} />
            {EXPERIMENT_TASK_STATUS_LABELS[status]}
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
        <ExperimentTaskActionMenu
          taskId={task.id}
          taskNo={task.taskNo}
          status={status}
          role={role}
          operatorOptions={operatorOptions}
          bioinfoEnabled={BIOINFO_SERVICE_LEVELS.includes(
            task.project.serviceLevel as ServiceLevelValue
          )}
          analystOptions={analystOptions}
          showEmptyHint
        />
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={`/experiment-tasks/${task.id}`} aria-label="在全页中打开">
              <Maximize2 aria-hidden="true" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={`/experiment-tasks/${task.id}/edit`} aria-label="编辑实验任务">
              <Edit aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>

      <Separator />
      <ExperimentTaskFields task={task} columns={2} />
      <Separator />
      <QcSection
        taskId={task.id}
        taskNo={task.taskNo}
        status={status}
        role={role}
        records={task.qcRecords}
      />
      <Separator />
      <RunMetricsSection
        experimentTaskId={task.id}
        taskNo={task.taskNo}
        status={status}
        role={role}
        metrics={pickRunMetrics(task.taskSamples)}
      />
      {canUploadRecord(status, role) && (
        <>
          <Separator />
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">实验记录</h3>
              <UploadRecordButton taskId={task.id} />
            </div>
            <p className="text-xs text-muted-foreground">
              上传上机实验记录照片，自动识别样本名与质控指标，人工核对确认后写入。
            </p>
          </section>
        </>
      )}
      <Separator />

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">时间线</h3>
        <OperationTimeline logs={operationLogs} />
      </section>
    </div>
  )
}
