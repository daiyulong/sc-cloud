import Link from "next/link"
import { PackageCheck, SearchX } from "lucide-react"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { parsePagination } from "@/lib/api-utils"
import {
  PROJECT_STATUS_LABELS,
  SERVICE_LEVEL_LABELS,
  ProjectStatus,
  type UserRole as UserRoleValue,
  type ProjectStatus as ProjectStatusValue,
  type ServiceLevel as ServiceLevelValue,
} from "@/lib/enums"
import { projectListQuerySchema } from "@/lib/schemas/project"
import { listProjects } from "@/lib/projects/service"
import { formatDate } from "@/lib/utils"
import { ClickableRow } from "@/components/list/clickable-row"
import { ListEmpty } from "@/components/list/list-empty"
import { ListToolbar } from "@/components/list/list-toolbar"
import { ProjectActionMenu } from "@/components/projects/project-action-menu"
import { PROJECT_STATUS_DOT, StatusDot } from "@/components/status-dot"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const dynamic = "force-dynamic"

type DeliveryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

// 交付页只关心交付相关状态：待交付（默认队列）+ 已完成（历史参考）
export default async function DeliveryPage({ searchParams }: DeliveryPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const raw = (await searchParams) ?? {}
  // 交付页是二选一：默认 = 待交付队列（deliveryScope），唯一可切的显式筛选 = 已完成（历史）
  const showCompleted = first(raw.status) === ProjectStatus.completed
  const status = showCompleted ? ProjectStatus.completed : undefined
  const query = projectListQuerySchema.parse({
    q: first(raw.q),
    status,
    // 无显式 status 时圈定「待交付」（确认交付即关闭，无独立已交付态）
    deliveryScope: true,
    page: first(raw.page),
    limit: first(raw.limit),
  })
  const { page, limit, skip } = parsePagination({
    page: first(raw.page),
    limit: first(raw.limit),
  })
  const { data: projects, total } = await listProjects(
    { id: session.user.id, role: session.user.role as UserRoleValue },
    query,
    { skip, limit }
  )
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const baseParams = new URLSearchParams()
  if (query.q) baseParams.set("q", query.q)
  if (status) baseParams.set("status", status)
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams(baseParams)
    params.set("page", String(nextPage))
    params.set("limit", String(limit))
    return `/delivery?${params.toString()}`
  }
  const hasActiveFilters = Boolean(query.q || status)

  return (
    <div className="group/list flex flex-1 flex-col gap-4 p-4 md:p-6">
      <h1 className="sr-only">交付</h1>
      <ListToolbar
        basePath="/delivery"
        searchPlaceholder="搜索项目编号 / 合同 / 客户…"
        searchDefault={query.q}
        filters={[
          {
            key: "status",
            label: "交付状态",
            allLabel: "待交付",
            value: status,
            options: [
              {
                value: ProjectStatus.completed,
                label: PROJECT_STATUS_LABELS[ProjectStatus.completed],
                dot: PROJECT_STATUS_DOT[ProjectStatus.completed],
              },
            ],
          },
        ]}
      />

      {total === 0 ? (
        hasActiveFilters ? (
          <ListEmpty
            icon={<SearchX />}
            title="无匹配结果"
            description="当前筛选条件下没有交付项目，调整或清除筛选后重试。"
          >
            <Button variant="outline" asChild>
              <Link href="/delivery">清除筛选</Link>
            </Button>
          </ListEmpty>
        ) : (
          <ListEmpty
            icon={<PackageCheck />}
            title="暂无待交付项目"
            description="项目完成实验或生信分析后会进入待交付队列，在此确认交付并关闭项目。"
          />
        )
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border bg-card transition-opacity group-has-[[data-pending]]/list:opacity-60">
            <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
              <TableHeader>
                <TableRow>
                  <TableHead>项目编号</TableHead>
                  <TableHead>客户</TableHead>
                  <TableHead>服务档次</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>预计交付</TableHead>
                  <TableHead>实际交付</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <ClickableRow key={project.id} href={`/projects/${project.id}`}>
                    <TableCell>
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-medium hover:underline"
                      >
                        {project.projectNo}
                      </Link>
                    </TableCell>
                    <TableCell>{project.customerOrg}</TableCell>
                    <TableCell>
                      {SERVICE_LEVEL_LABELS[project.serviceLevel as ServiceLevelValue]}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <StatusDot
                          className={PROJECT_STATUS_DOT[project.status as ProjectStatusValue]}
                        />
                        {PROJECT_STATUS_LABELS[project.status as ProjectStatusValue]}
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(project.expectedDeliveryDate)}</TableCell>
                    <TableCell>{formatDate(project.deliveredAt)}</TableCell>
                    <TableCell className="text-right">
                      <ProjectActionMenu
                        projectId={project.id}
                        projectNo={project.projectNo}
                        status={project.status as ProjectStatusValue}
                        role={session.user.role}
                        compact
                      />
                    </TableCell>
                  </ClickableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              共 {total} 个项目 · 第 {page} / {totalPages} 页
            </p>
            <div className="flex items-center gap-2">
              {page <= 1 ? (
                <Button variant="outline" size="sm" disabled>
                  上一页
                </Button>
              ) : (
                <Button variant="outline" size="sm" asChild>
                  <Link href={pageHref(page - 1)}>上一页</Link>
                </Button>
              )}
              {page >= totalPages ? (
                <Button variant="outline" size="sm" disabled>
                  下一页
                </Button>
              ) : (
                <Button variant="outline" size="sm" asChild>
                  <Link href={pageHref(page + 1)}>下一页</Link>
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
