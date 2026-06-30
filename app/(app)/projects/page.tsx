import Link from "next/link"
import { AlertCircle, FolderKanban, Plus, SearchX } from "lucide-react"
import { redirect } from "next/navigation"
import { getVerifiedSession } from "@/lib/auth/verified-session"
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
import {
  ATTENTION_STATUSES,
  listAttentionProjects,
  listProjects,
} from "@/lib/projects/service"
import { firstParam, formatDate } from "@/lib/utils"
import { ClickableRow } from "@/components/list/clickable-row"
import { ListEmpty } from "@/components/list/list-empty"
import { ListPager } from "@/components/list/list-pager"
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

// 项目终态：默认浏览队列时隐藏（多选状态默认勾选其余 8 态）。搜索或显式勾选则照常显示。
const TERMINAL_PROJECT_STATUSES: ProjectStatusValue[] = [
  ProjectStatus.completed,
  ProjectStatus.terminated,
]
const DEFAULT_STATUS_SELECTION: ProjectStatusValue[] = (
  Object.values(ProjectStatus) as ProjectStatusValue[]
).filter((status) => !TERMINAL_PROJECT_STATUSES.includes(status))

// 项目表列数（含操作列），供分组标题行 colSpan 用
const PROJECT_TABLE_COLS = 9

function canCreateProject(role?: UserRoleValue) {
  return role === UserRole.admin || role === UserRole.sales_owner || role === UserRole.project_manager
}

/** 单表内的分组标题行（需关注 / 其余项目）：跨列、不参与 hover、轻量分隔。 */
function GroupHeaderRow({
  label,
  count,
  tone,
}: {
  label: string
  count?: number
  tone?: "attention"
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell
        colSpan={PROJECT_TABLE_COLS}
        className="!py-2 bg-muted/40 text-xs font-medium text-muted-foreground"
      >
        <span className="flex items-center gap-1.5">
          {tone === "attention" && (
            <AlertCircle className="size-3.5 text-amber-500" aria-hidden="true" />
          )}
          <span className={tone === "attention" ? "text-amber-700 dark:text-amber-400" : undefined}>
            {label}
          </span>
          {count !== undefined && <span className="text-muted-foreground/70">（{count}）</span>}
        </span>
      </TableCell>
    </TableRow>
  )
}

type ProjectRow = Awaited<ReturnType<typeof listProjects>>["data"][number]

function ProjectRowCells({ project, role }: { project: ProjectRow; role?: string }) {
  return (
    <>
      <TableCell>
        <Link href={`/projects/${project.id}`} className="font-medium hover:underline">
          {project.projectNo ?? "未编号草稿"}
        </Link>
      </TableCell>
      <TableCell>{project.customerOrg}</TableCell>
      <TableCell>
        <span className="flex items-center gap-2 whitespace-nowrap">
          <StatusDot className={PROJECT_STATUS_DOT[project.status as ProjectStatusValue]} />
          {PROJECT_STATUS_LABELS[project.status as ProjectStatusValue]}
        </span>
      </TableCell>
      <TableCell>{SERVICE_LEVEL_LABELS[project.serviceLevel as ServiceLevelValue]}</TableCell>
      <TableCell>
        <UserCell user={project.salesOwner} />
      </TableCell>
      <TableCell>
        <UserCell user={project.projectManager} />
      </TableCell>
      <TableCell>{formatDate(project.expectedDeliveryDate)}</TableCell>
      <TableCell>{formatDate(project.deliveredAt)}</TableCell>
      <TableCell className="text-right">
        <ProjectActionMenu
          projectId={project.id}
          projectNo={project.projectNo}
          status={project.status as ProjectStatusValue}
          role={role}
          compact
        />
      </TableCell>
    </>
  )
}

function ProjectTableHead() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>项目编号</TableHead>
        <TableHead>客户</TableHead>
        <TableHead>状态</TableHead>
        <TableHead>服务档次</TableHead>
        <TableHead>销售</TableHead>
        <TableHead>项目经理</TableHead>
        <TableHead>预计交付</TableHead>
        <TableHead>实际交付</TableHead>
        <TableHead className="text-right">操作</TableHead>
      </TableRow>
    </TableHeader>
  )
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const session = await getVerifiedSession()
  if (!session) redirect("/login")
  const role = session.user.role as UserRoleValue
  const operator = { id: session.user.id, role }

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

  // 状态多选：未显式勾选时默认选「非终态」（隐藏已完成/已终止）。把解析后的选择注入 query，
  // 由 buildProjectListWhere 统一以 status IN 应用——浏览/搜索口径一致，工具栏「N/M」始终如实。
  const hasStatusFilter = Boolean(query.status?.length)
  const selectedStatuses = hasStatusFilter
    ? (query.status as ProjectStatusValue[])
    : DEFAULT_STATUS_SELECTION
  const effectiveQuery = { ...query, status: selectedStatuses }

  // 工位默认视图（第 1 页、无搜索/档次/到期筛选）：置顶「需关注」+ 其余排除三态、按预计交付近在前。
  // 状态多选不破坏分组（它只决定可见状态全集）；搜索/档次/到期/翻页 → 退回普通列表（最近更新序）。
  const hasNonStatusFilters = Boolean(query.q || query.serviceLevel || query.due)
  const isWorkstationView = !hasNonStatusFilters && page === 1
  // 空态判定：用户主动收窄（搜索/档次/到期/显式状态）才算"有筛选"，区分"无匹配"与"暂无项目"
  const hasActiveFilters = hasNonStatusFilters || hasStatusFilter

  const [{ data: projects, total }, attention] = await Promise.all([
    listProjects(
      operator,
      effectiveQuery,
      { skip, limit },
      isWorkstationView
        ? { excludeStatuses: ATTENTION_STATUSES, order: "deliverySoon" }
        : undefined
    ),
    isWorkstationView ? listAttentionProjects(operator, selectedStatuses) : Promise.resolve([]),
  ])

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
  const canCreate = canCreateProject(role)
  const showEmpty = total === 0 && attention.length === 0

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
            multiple: true,
            value: selectedStatuses.join(","),
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

      {showEmpty ? (
        hasActiveFilters ? (
          <ListEmpty
            icon={<SearchX />}
            title="无匹配结果"
            description="当前筛选条件下没有项目，调整状态筛选或清除后重试。"
          >
            <Button variant="outline" asChild>
              <Link href="/projects">清除筛选</Link>
            </Button>
          </ListEmpty>
        ) : (
          <ListEmpty
            icon={<FolderKanban />}
            title="暂无在途项目"
            description="默认隐藏已完成/已终止项目。点上方「项目状态」查看全部，或新建项目。"
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
          {/* 单表 + 置顶分组：一份表头、一层边框，列天然对齐（替代旧两表叠放） */}
          <div className="overflow-hidden rounded-lg border bg-card transition-opacity group-has-[[data-pending]]/list:opacity-60">
            <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
              <ProjectTableHead />
              <TableBody>
                {isWorkstationView && attention.length > 0 && (
                  <>
                    <GroupHeaderRow tone="attention" label="需关注" count={attention.length} />
                    {attention.map((project) => (
                      <ClickableRow
                        key={project.id}
                        href={`/projects/${project.id}`}
                        className="bg-amber-50/40 hover:bg-amber-50/70 dark:bg-amber-950/15 dark:hover:bg-amber-950/25"
                      >
                        <ProjectRowCells project={project} role={session.user.role} />
                      </ClickableRow>
                    ))}
                    {projects.length > 0 && <GroupHeaderRow label="其余项目" />}
                  </>
                )}
                {projects.map((project) => (
                  <ClickableRow key={project.id} href={`/projects/${project.id}`}>
                    <ProjectRowCells project={project} role={session.user.role} />
                  </ClickableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ListPager total={total} page={page} totalPages={totalPages} noun="项目" hrefFor={pageHref} />
        </>
      )}
    </div>
  )
}
