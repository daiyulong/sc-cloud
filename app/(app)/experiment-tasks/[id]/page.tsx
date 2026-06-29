import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Edit } from "lucide-react"
import { auth } from "@/lib/auth"
import { DetailBreadcrumb } from "@/components/detail/detail-breadcrumb"
import {
  EXPERIMENT_TASK_STATUS_LABELS,
  ExperimentTaskStatus,
  PROJECT_STATUS_LABELS,
  type ExperimentTaskStatus as ExperimentTaskStatusValue,
  type ProjectStatus as ProjectStatusValue,
  type UserRole as UserRoleValue,
} from "@/lib/enums"
import { getOperatorOptions } from "@/lib/experiment-tasks/options"
import { getExperimentTaskDetail } from "@/lib/experiment-tasks/service"
import { OperationTimeline } from "@/components/detail/operation-timeline"
import { ExperimentTaskActionMenu } from "@/components/experiment-tasks/experiment-task-action-menu"
import { ExperimentTaskFields } from "@/components/experiment-tasks/experiment-task-fields"
import { QcSection } from "@/components/experiment-tasks/qc-section"
import { RunMetricsSection } from "@/components/experiment-tasks/run-metrics-section"
import { pickRunMetrics } from "@/components/experiment-tasks/run-metrics"
import { UploadRecordButton } from "@/components/experiment-records/upload-record-button"
import { canUploadRecord } from "@/lib/experiment-records/permissions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const dynamic = "force-dynamic"

type ExperimentTaskDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function ExperimentTaskDetailPage({ params }: ExperimentTaskDetailPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params
  const [detail, operatorOptions] = await Promise.all([
    getExperimentTaskDetail(
      { id: session.user.id, role: session.user.role as UserRoleValue },
      id
    ).catch(() => null),
    getOperatorOptions(),
  ])
  if (!detail) notFound()

  const { task, operationLogs } = detail
  const status = task.status as ExperimentTaskStatusValue

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <DetailBreadcrumb backHref="/lab" backLabel="实验" current={task.taskNo} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal">{task.taskNo}</h1>
            <Badge variant={status === ExperimentTaskStatus.abnormal ? "destructive" : "secondary"}>
              {EXPERIMENT_TASK_STATUS_LABELS[status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            <Link href={`/projects/${task.project.id}`} className="hover:underline">
              {task.project.projectNo}
            </Link>{" "}
            · {task.project.customerOrg} ·{" "}
            {PROJECT_STATUS_LABELS[task.project.status as ProjectStatusValue]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExperimentTaskActionMenu
            taskId={task.id}
            taskNo={task.taskNo}
            status={status}
            role={session.user.role}
            operatorOptions={operatorOptions}
          />
          <Button asChild variant="outline">
            <Link href={`/experiment-tasks/${task.id}/edit`}>
              <Edit data-icon="inline-start" aria-hidden="true" />
              编辑
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>任务信息</CardTitle>
          <CardDescription>
            排期与执行的核心字段。外包测序下：完成实验 = 送外包测序，待反馈 = 等厂商数据回；数据回来后到
            <Link href={`/projects/${task.project.id}`} className="mx-1 font-medium text-foreground hover:underline">
              所属项目
            </Link>
            「测序交付」登记并透传生信。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExperimentTaskFields task={task} columns={3} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>质控</CardTitle>
          <CardDescription>结构化质量判断（可多条）</CardDescription>
        </CardHeader>
        <CardContent>
          <QcSection
            taskId={task.id}
            taskNo={task.taskNo}
            status={status}
            role={session.user.role}
            records={task.qcRecords}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>产出指标</CardTitle>
          <CardDescription>下机定量（cellranger）后补录，供相似经验参考</CardDescription>
        </CardHeader>
        <CardContent>
          <RunMetricsSection
            experimentTaskId={task.id}
            taskNo={task.taskNo}
            status={status}
            role={session.user.role}
            metrics={pickRunMetrics(task.taskSamples)}
          />
        </CardContent>
      </Card>

      {canUploadRecord(status, session.user.role) && (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <div className="flex flex-col gap-1.5">
              <CardTitle>实验记录</CardTitle>
              <CardDescription>上传记录照片，多模态识别样本名与质控指标，人工确认后写入</CardDescription>
            </div>
            <UploadRecordButton taskId={task.id} />
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>时间线</CardTitle>
          <CardDescription>来自操作日志</CardDescription>
        </CardHeader>
        <CardContent>
          <OperationTimeline logs={operationLogs} />
        </CardContent>
      </Card>
    </div>
  )
}
