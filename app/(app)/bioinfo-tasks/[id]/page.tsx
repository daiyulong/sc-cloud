import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Edit } from "lucide-react"
import { auth } from "@/lib/auth"
import {
  BIOINFO_TASK_STATUS_LABELS,
  BioinfoTaskStatus,
  PROJECT_STATUS_LABELS,
  type BioinfoTaskStatus as BioinfoTaskStatusValue,
  type ExperimentTaskStatus as ExperimentTaskStatusValue,
  type ProjectStatus as ProjectStatusValue,
  type UserRole as UserRoleValue,
} from "@/lib/enums"
import { getBioinfoTaskDetail } from "@/lib/bioinfo-tasks/service"
import { OperationTimeline } from "@/components/detail/operation-timeline"
import { BioinfoTaskActionMenu } from "@/components/bioinfo-tasks/bioinfo-task-action-menu"
import { BioinfoTaskFields } from "@/components/bioinfo-tasks/bioinfo-task-fields"
import { RunMetricsSection } from "@/components/experiment-tasks/run-metrics-section"
import { pickRunMetrics } from "@/components/experiment-tasks/run-metrics"
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

type BioinfoTaskDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function BioinfoTaskDetailPage({ params }: BioinfoTaskDetailPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params
  const detail = await getBioinfoTaskDetail(
    { id: session.user.id, role: session.user.role as UserRoleValue },
    id
  ).catch(() => null)
  if (!detail) notFound()

  const { task, operationLogs } = detail
  const status = task.status as BioinfoTaskStatusValue

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal">{task.taskNo}</h1>
            <Badge variant={status === BioinfoTaskStatus.abnormal ? "destructive" : "secondary"}>
              {BIOINFO_TASK_STATUS_LABELS[status]}
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
          <BioinfoTaskActionMenu
            taskId={task.id}
            taskNo={task.taskNo}
            status={status}
            role={session.user.role}
            analysisType={task.analysisType}
          />
          <Button asChild variant="outline">
            <Link href={`/bioinfo-tasks/${task.id}/edit`}>
              <Edit data-icon="inline-start" aria-hidden="true" />
              编辑
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>任务信息</CardTitle>
          <CardDescription>分析与交付的核心字段</CardDescription>
        </CardHeader>
        <CardContent>
          <BioinfoTaskFields task={task} columns={3} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>产出指标</CardTitle>
          <CardDescription>关联实验任务的下机定量指标，分析完成后补录</CardDescription>
        </CardHeader>
        <CardContent>
          <RunMetricsSection
            experimentTaskId={task.experimentTask.id}
            taskNo={task.experimentTask.taskNo}
            status={task.experimentTask.status as ExperimentTaskStatusValue}
            role={session.user.role}
            metrics={pickRunMetrics(task.experimentTask.taskSamples)}
          />
        </CardContent>
      </Card>

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
