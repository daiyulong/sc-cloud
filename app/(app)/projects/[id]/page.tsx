import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Edit, FileDown, Plus } from "lucide-react"
import { auth } from "@/lib/auth"
import {
  BIOINFO_TASK_STATUS_LABELS,
  EXPERIMENT_TASK_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  type BioinfoTaskStatus as BioinfoTaskStatusValue,
  type ExperimentTaskStatus as ExperimentTaskStatusValue,
  type ProjectStatus as ProjectStatusValue,
  type SampleBatchStatus as SampleBatchStatusValue,
  type UserRole as UserRoleValue,
} from "@/lib/enums"
import { getProjectDetail } from "@/lib/projects/service"
import { listSamples } from "@/lib/samples/service"
import { canActAsStaff } from "@/lib/auth/action-roles"
import { getOperatorOptions } from "@/lib/experiment-tasks/options"
import { listExperimentTasks } from "@/lib/experiment-tasks/service"
import { listBioinfoTasks } from "@/lib/bioinfo-tasks/service"
import { canRegisterDelivery, listProjectDeliveries } from "@/lib/sequencing-deliveries/service"
import { DeliverySection } from "@/components/sequencing-deliveries/delivery-section"
import { formatDate, formatDateTime } from "@/lib/utils"
import { ClickableRow } from "@/components/list/clickable-row"
import { OperationTimeline } from "@/components/detail/operation-timeline"
import { ProjectActionMenu } from "@/components/projects/project-action-menu"
import { ProjectFields } from "@/components/projects/project-fields"
import { ExperimentTaskActionMenu } from "@/components/experiment-tasks/experiment-task-action-menu"
import { BioinfoTaskActionMenu } from "@/components/bioinfo-tasks/bioinfo-task-action-menu"
import { SampleActionMenu } from "@/components/samples/sample-action-menu"
import {
  BIOINFO_TASK_STATUS_DOT,
  EXPERIMENT_TASK_STATUS_DOT,
  SAMPLE_STATUS_DOT,
  StatusDot,
} from "@/components/status-dot"
import { SAMPLE_BATCH_STATUS_LABELS } from "@/lib/enums"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const dynamic = "force-dynamic"

type ProjectDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params
  const operator = { id: session.user.id, role: session.user.role as UserRoleValue }
  const detail = await getProjectDetail(operator, id).catch(() => null)
  if (!detail) notFound()

  const { project, operationLogs } = detail
  const [{ data: samples }, { data: tasks }, { data: bioinfoTasks }, operatorOptions, deliveries] =
    await Promise.all([
      listSamples(operator, { projectId: id }, { skip: 0, limit: 20 }),
      listExperimentTasks(operator, { projectId: id }, { skip: 0, limit: 20 }),
      listBioinfoTasks(operator, { projectId: id }, { skip: 0, limit: 20 }),
      getOperatorOptions(),
      listProjectDeliveries(operator, id),
    ])
  const deliveryItems = deliveries.map((d) => ({
    id: d.id,
    storageUrl: d.storageUrl,
    attachmentName: d.attachmentName,
    note: d.note,
    createdAtLabel: formatDateTime(d.createdAt),
    createdByName: d.createdBy?.name ?? null,
  }))
  const canCreateTask = canActAsStaff(operator.role)
  const canCreateBioinfo = canActAsStaff(operator.role)

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal">{project.projectNo ?? "未编号草稿"}</h1>
            <Badge variant="secondary">
              {PROJECT_STATUS_LABELS[project.status as ProjectStatusValue]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {project.customerOrg} · {project.customerName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ProjectActionMenu
            projectId={project.id}
            projectNo={project.projectNo}
            status={project.status as ProjectStatusValue}
            role={session.user.role}
          />
          <Button asChild variant="outline">
            <a href={`/api/projects/${project.id}/task-order`}>
              <FileDown data-icon="inline-start" aria-hidden="true" />
              生成任务单
            </a>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/projects/${project.id}/edit`}>
              <Edit data-icon="inline-start" aria-hidden="true" />
              编辑
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>基础信息</CardTitle>
          <CardDescription>委托单粒度的项目主数据</CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectFields project={project} columns={3} />
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-3">
        <Link href={`/intake?projectId=${project.id}`} className="group">
          <Card className="transition-colors group-hover:border-primary/40">
            <CardHeader>
              <CardTitle>样本</CardTitle>
              <CardDescription>点击查看该项目全部样本</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold tabular-nums">
              {project._count.samples}
            </CardContent>
          </Card>
        </Link>
        <Link href={`/lab?projectId=${project.id}`} className="group">
          <Card className="transition-colors group-hover:border-primary/40">
            <CardHeader>
              <CardTitle>实验任务</CardTitle>
              <CardDescription>点击查看排期与质控</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold tabular-nums">
              {project._count.experimentTasks}
            </CardContent>
          </Card>
        </Link>
        <Link href={`/bioinfo-tasks?projectId=${project.id}`} className="group">
          <Card className="transition-colors group-hover:border-primary/40">
            <CardHeader>
              <CardTitle>生信任务</CardTitle>
              <CardDescription>点击查看分析与报告</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold tabular-nums">
              {project._count.bioinfoTasks}
            </CardContent>
          </Card>
        </Link>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>样本列表</CardTitle>
          <CardDescription>该项目下的样本与接收进度（最多展示 20 条）</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>样本编号 (YP)</TableHead>
                <TableHead>物种 / 组织</TableHead>
                <TableHead>实验类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>预计到样</TableHead>
                <TableHead>实际接收</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {samples.map((sample) => (
                <ClickableRow key={sample.id} href={`/samples/${sample.id}`}>
                  <TableCell>
                    <Link
                      href={`/samples/${sample.id}`}
                      className="font-medium hover:underline"
                    >
                      {sample.batchNo ?? "未编号"}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {sample.species} · {sample.tissueType}
                  </TableCell>
                  <TableCell>{sample.experimentType}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <StatusDot
                        className={SAMPLE_STATUS_DOT[sample.status as SampleBatchStatusValue]}
                      />
                      {SAMPLE_BATCH_STATUS_LABELS[sample.status as SampleBatchStatusValue]}
                    </span>
                  </TableCell>
                  <TableCell>{formatDate(sample.expectedArrivalDate)}</TableCell>
                  <TableCell>{formatDateTime(sample.receivedAt)}</TableCell>
                  <TableCell className="text-right">
                    <SampleActionMenu
                      sampleId={sample.id}
                      sampleNo={sample.batchNo ?? "未编号"}
                      status={sample.status as SampleBatchStatusValue}
                      role={session.user.role}
                      compact
                    />
                  </TableCell>
                </ClickableRow>
              ))}
              {samples.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                    暂无样本
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <CardTitle>实验任务</CardTitle>
            <CardDescription>该项目下的排期与执行进度（最多展示 20 条）</CardDescription>
          </div>
          {canCreateTask && (
            <Button asChild size="sm">
              <Link href="/experiment-tasks/new">
                <Plus data-icon="inline-start" aria-hidden="true" />
                新建任务
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>任务编号</TableHead>
                <TableHead>样本</TableHead>
                <TableHead>实验类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>计划日期</TableHead>
                <TableHead>负责人</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <ClickableRow key={task.id} href={`/experiment-tasks/${task.id}`}>
                  <TableCell>
                    <Link
                      href={`/experiment-tasks/${task.id}`}
                      className="font-medium hover:underline"
                    >
                      {task.taskNo}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {task.taskSamples.map((ts) => ts.sample.sampleName || "未命名").join("、") || "-"}
                  </TableCell>
                  <TableCell>{task.experimentType}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <StatusDot
                        className={EXPERIMENT_TASK_STATUS_DOT[task.status as ExperimentTaskStatusValue]}
                      />
                      {EXPERIMENT_TASK_STATUS_LABELS[task.status as ExperimentTaskStatusValue]}
                    </span>
                  </TableCell>
                  <TableCell>{formatDate(task.plannedDate)}</TableCell>
                  <TableCell>{task.operator?.name ?? "-"}</TableCell>
                  <TableCell className="text-right">
                    <ExperimentTaskActionMenu
                      taskId={task.id}
                      taskNo={task.taskNo}
                      status={task.status as ExperimentTaskStatusValue}
                      role={session.user.role}
                      operatorOptions={operatorOptions}
                      compact
                    />
                  </TableCell>
                </ClickableRow>
              ))}
              {tasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                    暂无实验任务
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <CardTitle>生信任务</CardTitle>
            <CardDescription>该项目下的分析与报告进度（最多展示 20 条）</CardDescription>
          </div>
          {canCreateBioinfo && (
            <Button asChild size="sm">
              <Link href="/bioinfo-tasks/new">
                <Plus data-icon="inline-start" aria-hidden="true" />
                新建任务
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>任务编号</TableHead>
                <TableHead>实验任务</TableHead>
                <TableHead>分析类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>分析负责人</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bioinfoTasks.map((task) => (
                <ClickableRow key={task.id} href={`/bioinfo-tasks/${task.id}`}>
                  <TableCell>
                    <Link
                      href={`/bioinfo-tasks/${task.id}`}
                      className="font-medium hover:underline"
                    >
                      {task.taskNo}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/experiment-tasks/${task.experimentTask.id}`}
                      className="hover:underline"
                    >
                      {task.experimentTask.taskNo}
                    </Link>
                  </TableCell>
                  <TableCell>{task.analysisType ?? "-"}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <StatusDot
                        className={BIOINFO_TASK_STATUS_DOT[task.status as BioinfoTaskStatusValue]}
                      />
                      {BIOINFO_TASK_STATUS_LABELS[task.status as BioinfoTaskStatusValue]}
                    </span>
                  </TableCell>
                  <TableCell>{task.analyst?.name ?? "-"}</TableCell>
                  <TableCell className="text-right">
                    <BioinfoTaskActionMenu
                      taskId={task.id}
                      taskNo={task.taskNo}
                      status={task.status as BioinfoTaskStatusValue}
                      role={session.user.role}
                      analysisType={task.analysisType}
                      compact
                    />
                  </TableCell>
                </ClickableRow>
              ))}
              {bioinfoTasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                    暂无生信任务
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>测序交付</CardTitle>
          <CardDescription>外包测序回数据的登记与透传（数据存储链接 / 厂商交付存证）</CardDescription>
        </CardHeader>
        <CardContent>
          <DeliverySection
            projectId={project.id}
            items={deliveryItems}
            canRegister={canRegisterDelivery(session.user.role)}
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
