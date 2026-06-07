import Link from "next/link"
import { FolderKanban, Plus, SearchX } from "lucide-react"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { parsePagination } from "@/lib/api-utils"
import {
  PROJECT_STATUS_LABELS,
  SERVICE_LEVEL_LABELS,
  ProjectStatus,
  ServiceLevel,
  UserRole,
  type UserRole as UserRoleValue,
  type ProjectStatus as ProjectStatusValue,
  type ServiceLevel as ServiceLevelValue,
} from "@/lib/enums"
import { projectListQuerySchema } from "@/lib/schemas/project"
import { listProjects } from "@/lib/projects/service"
import { firstParam, formatDate } from "@/lib/utils"
import { ClickableRow } from "@/components/list/clickable-row"
import { ListEmpty } from "@/components/list/list-empty"
import { ListToolbar } from "@/components/list/list-toolbar"
import { ProjectActionMenu } from "@/components/projects/project-action-menu"
import { PROJECT_STATUS_DOT, StatusDot } from "@/components/status-dot"
import { UserCell } from "@/components/user-cell"
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

type ProjectsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function canCreateProject(role?: UserRoleValue) {
  return role === UserRole.admin || role === UserRole.sales_owner || role === UserRole.project_manager
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const raw = (await searchParams) ?? {}
  const query = projectListQuerySchema.parse({
    q: firstParam(raw.q),
    status: firstParam(raw.status),
    serviceLevel: firstParam(raw.serviceLevel),
    salesOwnerId: firstParam(raw.salesOwnerId),
    projectManagerId: firstParam(raw.projectManagerId),
    due: firstParam(raw.due),
    page: firstParam(raw.page),
    limit: firstParam(raw.limit),
  })
  const { page, limit, skip } = parsePagination({
    page: firstParam(raw.page),
    limit: firstParam(raw.limit),
  })
  const { data: projects, total } = await listProjects(
    { id: session.user.id, role: session.user.role as UserRoleValue },
    query,
    { skip, limit }
  )
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const baseParams = new URLSearchParams()
  for (const key of ["q", "status", "serviceLevel", "salesOwnerId", "projectManagerId", "due"]) {
    const value = firstParam(raw[key])
    if (value) baseParams.set(key, value)
  }
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams(baseParams)
    params.set("page", String(nextPage))
    params.set("limit", String(limit))
    return `/projects?${params.toString()}`
  }
  const canCreate = canCreateProject(session.user.role as UserRoleValue)
  const hasActiveFilters = Boolean(query.q || query.status || query.serviceLevel || query.due)

  return (
    <div className="group/list flex flex-1 flex-col gap-4 p-4 md:p-6">
      <h1 className="sr-only">项目</h1>
      <ListToolbar
        basePath="/projects"
        searchPlaceholder="搜索项目编号 / 合同 / 客户…"
        searchDefault={query.q}
        filters={[
          {
            key: "status",
            label: "项目状态",
            allLabel: "全部状态",
            value: query.status,
            options: Object.values(ProjectStatus).map((value) => ({
              value,
              label: PROJECT_STATUS_LABELS[value],
              dot: PROJECT_STATUS_DOT[value],
            })),
          },
          {
            key: "serviceLevel",
            label: "服务档次",
            allLabel: "全部档次",
            value: query.serviceLevel,
            options: Object.values(ServiceLevel).map((value) => ({
              value,
              label: SERVICE_LEVEL_LABELS[value],
            })),
          },
        ]}
      >
        {canCreate && (
          <Button asChild>
            <Link href="/projects/new">
              <Plus data-icon="inline-start" aria-hidden="true" />
              新建项目
            </Link>
          </Button>
        )}
      </ListToolbar>

      {total === 0 ? (
        hasActiveFilters ? (
          <ListEmpty
            icon={<SearchX />}
            title="无匹配结果"
            description="当前筛选条件下没有项目，调整或清除筛选后重试。"
          >
            <Button variant="outline" asChild>
              <Link href="/projects">清除筛选</Link>
            </Button>
          </ListEmpty>
        ) : (
          <ListEmpty
            icon={<FolderKanban />}
            title="暂无项目"
            description="从新建第一个项目开始。"
          >
            {canCreate && (
              <Button asChild>
                <Link href="/projects/new">
                  <Plus data-icon="inline-start" aria-hidden="true" />
                  新建项目
                </Link>
              </Button>
            )}
          </ListEmpty>
        )
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border bg-card transition-opacity group-has-[[data-pending]]/list:opacity-60">
            <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
              <TableHeader>
                <TableRow>
                  <TableHead>项目编号</TableHead>
                  <TableHead>客户</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>服务档次</TableHead>
                  <TableHead>销售</TableHead>
                  <TableHead>项目经理</TableHead>
                  <TableHead>预计交付</TableHead>
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
                        {project.projectNo ?? "未编号草稿"}
                      </Link>
                    </TableCell>
                    <TableCell>{project.customerOrg}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <StatusDot
                          className={PROJECT_STATUS_DOT[project.status as ProjectStatusValue]}
                        />
                        {PROJECT_STATUS_LABELS[project.status as ProjectStatusValue]}
                      </span>
                    </TableCell>
                    <TableCell>
                      {SERVICE_LEVEL_LABELS[project.serviceLevel as ServiceLevelValue]}
                    </TableCell>
                    <TableCell>
                      <UserCell user={project.salesOwner} />
                    </TableCell>
                    <TableCell>
                      <UserCell user={project.projectManager} />
                    </TableCell>
                    <TableCell>{formatDate(project.expectedDeliveryDate)}</TableCell>
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
