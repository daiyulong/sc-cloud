import Link from "next/link"
import { Edit, Maximize2 } from "lucide-react"
import {
  PROJECT_STATUS_LABELS,
  type ProjectStatus as ProjectStatusValue,
} from "@/lib/enums"
import type { getProjectDetail } from "@/lib/projects/service"
import { OperationTimeline } from "@/components/detail/operation-timeline"
import { ProjectActionMenu } from "@/components/projects/project-action-menu"
import { ProjectFields } from "@/components/projects/project-fields"
import { PROJECT_STATUS_DOT, StatusDot } from "@/components/status-dot"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

type ProjectDetail = Awaited<ReturnType<typeof getProjectDetail>>

/** 侧滑详情内容（server 渲染）：头部 + 动作 + 核心字段 + 关联计数 + 时间线 */
export function ProjectSheetBody({ detail, role }: { detail: ProjectDetail; role?: string }) {
  const { project, operationLogs } = detail
  const status = project.status as ProjectStatusValue

  return (
    <div className="flex flex-col gap-5 p-6">
      <header className="flex flex-col gap-2 pr-8">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{project.projectNo}</h2>
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <StatusDot className={PROJECT_STATUS_DOT[status]} />
            {PROJECT_STATUS_LABELS[status]}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {project.customerOrg} · {project.customerName}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <ProjectActionMenu
          projectId={project.id}
          projectNo={project.projectNo}
          status={status}
          role={role}
          showEmptyHint
        />
        <div className="ml-auto flex items-center gap-1.5">
          {/* 原生 <a> 硬导航绕过拦截，直达全页 */}
          <Button variant="ghost" size="icon-sm" asChild>
            <a href={`/projects/${project.id}`} aria-label="在全页中打开">
              <Maximize2 aria-hidden="true" />
            </a>
          </Button>
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={`/projects/${project.id}/edit`} aria-label="编辑项目">
              <Edit aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>

      <Separator />
      <ProjectFields project={project} columns={2} />
      <Separator />

      <p className="text-sm text-muted-foreground">
        <Link
          href={`/samples?projectId=${project.id}`}
          className="font-medium text-foreground hover:underline"
        >
          样本 {project._count.samples}
        </Link>
        {" · "}
        <Link
          href={`/experiment-tasks?projectId=${project.id}`}
          className="font-medium text-foreground hover:underline"
        >
          实验任务 {project._count.experimentTasks}
        </Link>
        {" · "}
        <Link
          href={`/bioinfo-tasks?projectId=${project.id}`}
          className="font-medium text-foreground hover:underline"
        >
          生信任务 {project._count.bioinfoTasks}
        </Link>
      </p>

      <Separator />

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">时间线</h3>
        <OperationTimeline logs={operationLogs} />
      </section>
    </div>
  )
}
