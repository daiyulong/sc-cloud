import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Edit } from "lucide-react"
import { auth } from "@/lib/auth"
import {
  PROJECT_STATUS_LABELS,
  SERVICE_LEVEL_LABELS,
  USER_ROLE_LABELS,
  type ProjectStatus as ProjectStatusValue,
  type ServiceLevel as ServiceLevelValue,
  type UserRole as UserRoleValue,
} from "@/lib/enums"
import { getProjectDetail } from "@/lib/projects/service"
import { formatDate, formatDateTime } from "@/lib/utils"
import { ProjectActions } from "@/components/projects/project-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export const dynamic = "force-dynamic"

type ProjectDetailPageProps = {
  params: Promise<{ id: string }>
}

function FieldLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value || "-"}</span>
    </div>
  )
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params
  const detail = await getProjectDetail(
    { id: session.user.id, role: session.user.role as UserRoleValue },
    id
  ).catch(() => null)
  if (!detail) notFound()

  const { project, operationLogs } = detail

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal">{project.projectNo}</h1>
            <Badge variant="secondary">
              {PROJECT_STATUS_LABELS[project.status as ProjectStatusValue]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {project.customerOrg} · {project.customerName}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/projects/${project.id}/edit`}>
            <Edit data-icon="inline-start" aria-hidden="true" />
            编辑
          </Link>
        </Button>
      </div>

      <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>基础信息</CardTitle>
            <CardDescription>委托单粒度的项目主数据</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-3">
            <FieldLine label="合同编号" value={project.contractNo} />
            <FieldLine label="委托单编号" value={project.orderNo} />
            <FieldLine
              label="服务档次"
              value={SERVICE_LEVEL_LABELS[project.serviceLevel as ServiceLevelValue]}
            />
            <FieldLine label="项目类型" value={project.projectType} />
            <FieldLine label="服务内容" value={project.serviceItems} />
            <FieldLine label="优先级" value={project.priority} />
            <FieldLine label="销售负责人" value={project.salesOwner?.name} />
            <FieldLine label="项目经理" value={project.projectManager?.name} />
            <FieldLine label="预计交付" value={formatDate(project.expectedDeliveryDate)} />
            <FieldLine label="测序平台" value={project.sequencingPlatform} />
            <FieldLine label="实际交付" value={formatDateTime(project.deliveredAt)} />
            <FieldLine label="创建时间" value={formatDateTime(project.createdAt)} />
            <div className="md:col-span-3">
              <FieldLine label="备注" value={project.remark} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>项目动作</CardTitle>
            <CardDescription>状态只能通过语义化动作推进</CardDescription>
          </CardHeader>
          <CardContent>
            <ProjectActions
              projectId={project.id}
              status={project.status as ProjectStatusValue}
              role={session.user.role}
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>样本</CardTitle>
            <CardDescription>后续接入样本接收模块</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold tabular-nums">
            {project._count.samples}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>实验任务</CardTitle>
            <CardDescription>后续接入排期与质控</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold tabular-nums">
            {project._count.experimentTasks}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>生信任务</CardTitle>
            <CardDescription>后续接入分析与报告</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold tabular-nums">
            {project._count.bioinfoTasks}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>时间线</CardTitle>
          <CardDescription>来自操作日志</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {operationLogs.map((log) => (
            <div key={log.id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{log.action}</Badge>
                  <span className="text-sm font-medium">{log.operator.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {USER_ROLE_LABELS[log.operator.role as UserRoleValue]}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(log.createdAt)}
                </span>
              </div>
              <Separator />
            </div>
          ))}
          {operationLogs.length === 0 && (
            <p className="text-sm text-muted-foreground">暂无操作日志。</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
