import Link from "next/link"
import {
  BIOINFO_TASK_STATUS_LABELS,
  BioinfoTaskStatus,
  PROJECT_STATUS_LABELS,
  type BioinfoTaskStatus as BioinfoTaskStatusValue,
  type ExperimentTaskStatus as ExperimentTaskStatusValue,
  type ProjectStatus as ProjectStatusValue,
} from "@/lib/enums"
import type { getBioinfoTaskDetail } from "@/lib/bioinfo-tasks/service"
import { canActAsStaff } from "@/lib/auth/action-roles"
import { formatDate, formatDateTime, toDateString } from "@/lib/utils"
import { EditableSection } from "@/components/detail/editable-section"
import { WorkItemHeader } from "@/components/detail/work-item-header"
import { BioinfoTaskActionMenu } from "@/components/bioinfo-tasks/bioinfo-task-action-menu"
import type { AnalystOption } from "@/components/bioinfo-tasks/bioinfo-task-form"
import { BioinfoTaskPrimaryAction } from "@/components/bioinfo-tasks/bioinfo-task-primary-action"
import { RunMetricsSection } from "@/components/experiment-tasks/run-metrics-section"
import { pickRunMetrics } from "@/components/experiment-tasks/run-metrics"
import { BIOINFO_TASK_STATUS_DOT, StatusDot } from "@/components/status-dot"
import { Separator } from "@/components/ui/separator"

type BioinfoTaskDetail = Awaited<ReturnType<typeof getBioinfoTaskDetail>>

/** 终局状态：无需主动作，开放修正入口 */
const BIOINFO_TERMINAL_STATUSES = new Set<BioinfoTaskStatusValue>([
  BioinfoTaskStatus.delivered,
  BioinfoTaskStatus.abnormal,
])

export function BioinfoTaskWorkItemBody({
  detail,
  role,
  analystOptions,
}: {
  detail: BioinfoTaskDetail
  role?: string
  analystOptions: AnalystOption[]
}) {
  const { task } = detail
  const status = task.status as BioinfoTaskStatusValue
  const project = task.project
  const projectStatus = project.status as ProjectStatusValue
  const editable = canActAsStaff(role)
  const isTerminal = BIOINFO_TERMINAL_STATUSES.has(status)
  const showPrimaryAction = editable && !isTerminal
  const endpoint = `/api/bioinfo-tasks/${task.id}`
  const dataReceivedAtValue = toDateString(task.dataReceivedAt)
  const analystOptionsForSelect = analystOptions.map((analyst) => ({
    value: analyst.id,
    label: analyst.department ? `${analyst.name} · ${analyst.department}` : analyst.name,
  }))
  const taskInfoFields = [
    {
      name: "experimentTask",
      label: "关联实验任务",
      displayValue: task.experimentTask.taskNo,
      href: `/lab?view=${task.experimentTask.id}`,
      editable: false,
    },
    {
      name: "analysisType",
      label: "分析类型",
      value: task.analysisType,
      placeholder: "标准分析 / 高级分析…",
    },
    {
      name: "analystId",
      label: "分析负责人",
      value: task.analystId,
      displayValue: task.analyst?.name,
      type: "select" as const,
      options: analystOptionsForSelect,
      placeholder: "选择负责人",
    },
    {
      name: "dataReceivedAt",
      label: "数据接收日期",
      value: dataReceivedAtValue,
      displayValue: dataReceivedAtValue ? formatDate(task.dataReceivedAt) : null,
      type: "date" as const,
    },
    {
      name: "deliveredAt",
      label: "报告交付日期",
      displayValue: formatDate(task.deliveredAt),
      editable: false,
    },
    {
      name: "createdAt",
      label: "创建时间",
      displayValue: formatDateTime(task.createdAt),
      editable: false,
    },
    {
      name: "deliverableNote",
      label: "交付物说明",
      value: task.deliverableNote,
      type: "textarea" as const,
      placeholder: "报告、矩阵文件、图表等…",
      multiline: true,
      span: "full" as const,
    },
    {
      name: "remark",
      label: "备注",
      value: task.remark,
      type: "textarea" as const,
      placeholder: "补充分析说明…",
      multiline: true,
      span: "full" as const,
    },
  ]

  return (
    <>
      <WorkItemHeader
        title={task.taskNo}
        statusLabel={BIOINFO_TASK_STATUS_LABELS[status]}
        statusDotClassName={BIOINFO_TASK_STATUS_DOT[status]}
        project={{
          id: project.id,
          projectNo: project.projectNo,
          customerOrg: project.customerOrg,
          statusLabel: PROJECT_STATUS_LABELS[projectStatus],
        }}
        actionMenu={
          <BioinfoTaskActionMenu
            taskId={task.id}
            taskNo={task.taskNo}
            status={status}
            role={role}
            analysisType={task.analysisType}
          />
        }
      />
      <main className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="flex flex-col gap-5">
          {showPrimaryAction && (
            <>
              <BioinfoTaskPrimaryAction
                taskId={task.id}
                taskNo={task.taskNo}
                status={status}
                analysisType={task.analysisType}
              />
              <Separator />
            </>
          )}

          <EditableSection
            title={isTerminal ? "修正信息" : "任务信息"}
            endpoint={endpoint}
            fields={taskInfoFields}
            editable={isTerminal && editable}
            editLabel="修正"
            successMessage="任务信息已保存"
          />

          <Separator />
          <RunMetricsSection
            experimentTaskId={task.experimentTask.id}
            taskNo={task.experimentTask.taskNo}
            status={task.experimentTask.status as ExperimentTaskStatusValue}
            role={role}
            metrics={pickRunMetrics(task.experimentTask.taskSamples)}
          />
        </div>
      </main>
    </>
  )
}
