import Link from "next/link"
import { Plus } from "lucide-react"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { parsePagination } from "@/lib/api-utils"
import {
  PROJECT_STATUS_LABELS,
  SERVICE_LEVEL_LABELS,
  ProjectStatus,
  UserRole,
  type UserRole as UserRoleValue,
  type ProjectStatus as ProjectStatusValue,
  type ServiceLevel as ServiceLevelValue,
} from "@/lib/enums"
import { projectListQuerySchema } from "@/lib/schemas/project"
import { listProjects } from "@/lib/projects/service"
import { formatDate } from "@/lib/utils"
import { ProjectFilters } from "@/components/projects/project-filters"
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

type ProjectsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function canCreateProject(role?: UserRoleValue) {
  return role === UserRole.admin || role === UserRole.sales_owner || role === UserRole.project_manager
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const raw = (await searchParams) ?? {}
  const query = projectListQuerySchema.parse({
    q: first(raw.q),
    status: first(raw.status),
    serviceLevel: first(raw.serviceLevel),
    salesOwnerId: first(raw.salesOwnerId),
    projectManagerId: first(raw.projectManagerId),
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
  for (const key of ["q", "status", "serviceLevel", "salesOwnerId", "projectManagerId"]) {
    const value = first(raw[key])
    if (value) baseParams.set(key, value)
  }
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams(baseParams)
    params.set("page", String(nextPage))
    params.set("limit", String(limit))
    return `/projects?${params.toString()}`
  }

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-normal">项目</h1>
          <p className="text-sm text-muted-foreground">委托单粒度的项目主数据与状态入口。</p>
        </div>
        {canCreateProject(session.user.role as UserRoleValue) && (
          <Button asChild>
            <Link href="/projects/new">
              <Plus data-icon="inline-start" aria-hidden="true" />
              新建项目
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>筛选</CardTitle>
          <CardDescription>服务端会自动叠加当前角色的数据可见范围</CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectFilters
            initial={{
              q: query.q,
              status: query.status,
              serviceLevel: query.serviceLevel,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>项目列表</CardTitle>
          <CardDescription>
            共 {total} 个项目，第 {page} / {totalPages} 页
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
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
                <TableRow key={project.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{project.projectNo}</span>
                      <span className="text-xs text-muted-foreground">{project.orderNo}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{project.customerOrg}</span>
                      <span className="text-xs text-muted-foreground">{project.customerName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        project.status === ProjectStatus.abnormal ? "destructive" : "secondary"
                      }
                    >
                      {PROJECT_STATUS_LABELS[project.status as ProjectStatusValue]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {SERVICE_LEVEL_LABELS[project.serviceLevel as ServiceLevelValue]}
                  </TableCell>
                  <TableCell>{project.salesOwner?.name ?? "-"}</TableCell>
                  <TableCell>{project.projectManager?.name ?? "-"}</TableCell>
                  <TableCell>{formatDate(project.expectedDeliveryDate)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/projects/${project.id}`}>详情</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {projects.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    暂无项目
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="mt-4 flex items-center justify-end gap-2">
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
        </CardContent>
      </Card>
    </div>
  )
}
