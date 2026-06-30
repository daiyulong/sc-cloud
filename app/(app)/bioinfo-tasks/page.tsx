import Link from "next/link"
import { Dna, FlaskConical, Plus, SearchX } from "lucide-react"
import { redirect } from "next/navigation"
import { cn, firstParam, formatDate } from "@/lib/utils"
import { getVerifiedSession } from "@/lib/auth/verified-session"
import { parsePagination } from "@/lib/api-utils"
import {
  BIOINFO_TASK_STATUS_LABELS,
  BioinfoTaskStatus,
  type BioinfoTaskStatus as BioinfoTaskStatusValue,
  type UserRole as UserRoleValue,
} from "@/lib/enums"
import { buildProjectScope } from "@/lib/auth/role-scope"
import { prisma } from "@/lib/prisma"
import { bioinfoTaskListQuerySchema } from "@/lib/schemas/bioinfo-task"
import { experimentTaskListQuerySchema } from "@/lib/schemas/experiment-task"
import { canActAsStaff } from "@/lib/auth/action-roles"
import { getBioinfoTaskDetail, listBioinfoTasks } from "@/lib/bioinfo-tasks/service"
import { getAnalystOptions, getBioinfoExperimentTaskOptions } from "@/lib/bioinfo-tasks/options"
import { listExperimentTasks } from "@/lib/experiment-tasks/service"
import { ClickableRow } from "@/components/list/clickable-row"
import { ListEmpty } from "@/components/list/list-empty"
import { ListPager } from "@/components/list/list-pager"
import { ListToolbar } from "@/components/list/list-toolbar"
import { DetailSheet, DetailSheetEmpty } from "@/components/detail/detail-sheet"
import { FormDialog } from "@/components/detail/form-dialog"
import { BioinfoTaskActionMenu } from "@/components/bioinfo-tasks/bioinfo-task-action-menu"
import { BioinfoTaskForm } from "@/components/bioinfo-tasks/bioinfo-task-form"
import { BioinfoTaskSheetBody } from "@/components/bioinfo-tasks/bioinfo-task-sheet-body"
import { BIOINFO_TASK_STATUS_DOT, StatusDot } from "@/components/status-dot"
import { UserCell } from "@/components/user-cell"
import { Badge } from "@/components/ui/badge"
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

type BioinfoTasksPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

// 分析终态：默认浏览「进行中」tab 时隐藏（让 tab 名实相符）。搜索或显式勾选则照常显示。
const TERMINAL_BIOINFO_STATUSES: BioinfoTaskStatusValue[] = [
  BioinfoTaskStatus.delivered,
  BioinfoTaskStatus.abnormal,
]
const DEFAULT_BIOINFO_STATUS_SELECTION: BioinfoTaskStatusValue[] = (
  Object.values(BioinfoTaskStatus) as BioinfoTaskStatusValue[]
).filter((status) => !TERMINAL_BIOINFO_STATUSES.includes(status))

function TabLink({
  href,
  active,
  count,
  children,
}: {
  href: string
  active: boolean
  count: number
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-2 border-b-2 px-1 pb-2.5 text-sm font-medium transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
      <Badge variant={active ? "default" : "secondary"} className="h-5 min-w-5 justify-center px-1.5">
        {count}
      </Badge>
    </Link>
  )
}

export default async function BioinfoTasksPage({ searchParams }: BioinfoTasksPageProps) {
  const session = await getVerifiedSession()
  if (!session) redirect("/login")
  const role = session.user.role as UserRoleValue
  const operator = { id: session.user.id, role }

  const raw = (await searchParams) ?? {}
  const tab = firstParam(raw.tab) === "pending" ? "pending" : "active"
  const viewId = tab === "active" ? firstParam(raw.view) : undefined
  const canCreate = canActAsStaff(role)
  const { page, limit, skip } = parsePagination({ page: firstParam(raw.page), limit: firstParam(raw.limit) })

  // 进行中（over BioinfoTask）查询
  const bioinfoQuery = bioinfoTaskListQuerySchema.parse({
    q: tab === "active" ? firstParam(raw.q) : undefined,
    status: firstParam(raw.status),
    projectId: firstParam(raw.projectId),
    analystId: firstParam(raw.analystId),
    open: firstParam(raw.open),
  })
  // 待建（over ExperimentTask，复用 awaiting=bioinfo 队列 where）查询
  const pendingQuery = experimentTaskListQuerySchema.parse({
    q: tab === "pending" ? firstParam(raw.q) : undefined,
    awaiting: "bioinfo",
  })

  // 状态多选（仅「进行中」tab）：未显式勾选且非 open 队列时默认隐藏终态，使"进行中"名实相符。
  const hasStatusFilter = Boolean(bioinfoQuery.status?.length)
  const useStatusDefault = !hasStatusFilter && !bioinfoQuery.open
  const selectedStatuses = hasStatusFilter
    ? (bioinfoQuery.status as BioinfoTaskStatusValue[])
    : useStatusDefault
      ? DEFAULT_BIOINFO_STATUS_SELECTION
      : undefined
  const effectiveBioinfoQuery = { ...bioinfoQuery, status: selectedStatuses }

  // 两 tab 实体粒度不同，需两套数据；非激活 tab 仅取 total 作角标（limit:1）。
  const [bioinfoRes, pendingRes, contextProject] = await Promise.all([
    listBioinfoTasks(operator, effectiveBioinfoQuery, tab === "active" ? { skip, limit } : { skip: 0, limit: 1 }),
    listExperimentTasks(operator, pendingQuery, tab === "pending" ? { skip, limit } : { skip: 0, limit: 1 }),
    bioinfoQuery.projectId
      ? prisma.project.findFirst({
          where: { AND: [{ id: bioinfoQuery.projectId }, buildProjectScope(role)] },
          select: { projectNo: true },
        })
      : null,
  ])

  const viewDetail = viewId
    ? await getBioinfoTaskDetail(operator, viewId).catch(() => null)
    : null
  // ?new=1 模态：在队列里建生信任务（成功后关模态回列表、不跳全页）
  const isNew = firstParam(raw.new) === "1"
  const initialExperimentTaskId = firstParam(raw.experimentTaskId)
  const [newExperimentTaskOptions, newAnalystOptions] =
    isNew && canCreate
      ? await Promise.all([
          getBioinfoExperimentTaskOptions(operator, { projectId: bioinfoQuery.projectId }),
          getAnalystOptions(),
        ])
      : [[], []]

  const activeCount = bioinfoRes.total
  const pendingCount = pendingRes.total

  const tabParams = (nextTab: "active" | "pending") => {
    const params = new URLSearchParams()
    if (nextTab !== "active") params.set("tab", nextTab)
    return params.size ? `/bioinfo-tasks?${params.toString()}` : "/bioinfo-tasks"
  }

  return (
    <div className="group/list flex flex-1 flex-col gap-4 p-4 md:p-6">
      <h1 className="sr-only">生信</h1>

      <div className="flex items-center gap-5 border-b">
        <TabLink href={tabParams("pending")} active={tab === "pending"} count={pendingCount}>
          待建
        </TabLink>
        <TabLink href={tabParams("active")} active={tab === "active"} count={activeCount}>
          进行中
        </TabLink>
      </div>

      {tab === "pending" ? (
        <PendingTab
          tasks={pendingRes.data}
          total={pendingRes.total}
          page={page}
          limit={limit}
          q={firstParam(raw.q)}
          canCreate={canCreate}
        />
      ) : (
        <ActiveTab
          tasks={bioinfoRes.data}
          total={bioinfoRes.total}
          page={page}
          limit={limit}
          raw={raw}
          query={bioinfoQuery}
          statusValue={(selectedStatuses ?? []).join(",")}
          hasExplicitStatus={hasStatusFilter}
          contextProjectNo={contextProject?.projectNo}
          canCreate={canCreate}
          role={session.user.role}
        />
      )}

      {viewId && (
        <DetailSheet title={viewDetail ? `生信任务 ${viewDetail.task.taskNo}` : "生信任务详情"}>
          {viewDetail ? (
            <BioinfoTaskSheetBody detail={viewDetail} role={session.user.role} />
          ) : (
            <DetailSheetEmpty message="生信任务不存在或无权限查看。" />
          )}
        </DetailSheet>
      )}

      {isNew && canCreate && (
        <FormDialog param="new" title="新建生信任务">
          <BioinfoTaskForm
            mode="create"
            surface="modal"
            experimentTaskOptions={newExperimentTaskOptions}
            analystOptions={newAnalystOptions}
            initialExperimentTaskId={initialExperimentTaskId}
          />
        </FormDialog>
      )}
    </div>
  )
}

// —— 进行中：BioinfoTask 队列（start/submit/review 行内动作） ——
function ActiveTab({
  tasks,
  total,
  page,
  limit,
  raw,
  query,
  statusValue,
  hasExplicitStatus,
  contextProjectNo,
  canCreate,
  role,
}: {
  tasks: Awaited<ReturnType<typeof listBioinfoTasks>>["data"]
  total: number
  page: number
  limit: number
  raw: Record<string, string | string[] | undefined>
  query: ReturnType<typeof bioinfoTaskListQuerySchema.parse>
  statusValue: string
  hasExplicitStatus: boolean
  contextProjectNo?: string | null
  canCreate: boolean
  role?: string
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const baseParams = new URLSearchParams()
  baseParams.set("tab", "active")
  for (const key of ["q", "status", "projectId", "analystId", "open"]) {
    const value = firstParam(raw[key])
    if (value) baseParams.set(key, value)
  }
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams(baseParams)
    params.set("page", String(nextPage))
    params.set("limit", String(limit))
    return `/bioinfo-tasks?${params.toString()}`
  }
  // ?view=<id> 抽屉：保留当前 tab/筛选/页，叠加 view 参数
  const viewHref = (id: string) => {
    const params = new URLSearchParams(baseParams)
    if (page > 1) params.set("page", String(page))
    params.set("view", id)
    return `/bioinfo-tasks?${params.toString()}`
  }
  const newHref = (() => {
    const params = new URLSearchParams(baseParams)
    params.set("new", "1")
    return `/bioinfo-tasks?${params.toString()}`
  })()
  const hasActiveFilters = Boolean(query.q || hasExplicitStatus || query.open)
  const clearFiltersHref = query.projectId
    ? `/bioinfo-tasks?tab=active&projectId=${query.projectId}`
    : "/bioinfo-tasks?tab=active"

  return (
    <>
      <ListToolbar
        basePath="/bioinfo-tasks"
        searchPlaceholder="搜索任务编号 / 分析类型 / 实验任务 / 项目…"
        searchDefault={query.q}
        filters={[
          {
            key: "status",
            label: "分析状态",
            allLabel: "全部状态",
            multiple: true,
            value: statusValue,
            options: Object.values(BioinfoTaskStatus).map((value) => ({
              value,
              label: BIOINFO_TASK_STATUS_LABELS[value],
              dot: BIOINFO_TASK_STATUS_DOT[value],
            })),
          },
        ]}
        context={
          query.projectId
            ? { label: `项目：${contextProjectNo ?? query.projectId}`, clearKeys: ["projectId"] }
            : undefined
        }
      >
        {canCreate && (
          <Button asChild>
            <Link href={newHref}>
              <Plus data-icon="inline-start" aria-hidden="true" />
              新建任务
            </Link>
          </Button>
        )}
      </ListToolbar>

      {total === 0 ? (
        hasActiveFilters ? (
          <ListEmpty icon={<SearchX />} title="无匹配结果" description="当前筛选条件下没有生信任务，调整或清除筛选后重试。">
            <Button variant="outline" asChild>
              <Link href={clearFiltersHref}>清除筛选</Link>
            </Button>
          </ListEmpty>
        ) : (
          <ListEmpty
            icon={<Dna />}
            title="暂无进行中的生信任务"
            description="默认隐藏已交付/异常。点上方「分析状态」查看全部，或到「待建」从已完成实验任务建任务。"
          />
        )
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border bg-card transition-opacity group-has-[[data-pending]]/list:opacity-60">
            <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
              <TableHeader>
                <TableRow>
                  <TableHead>任务编号</TableHead>
                  <TableHead>关联实验任务</TableHead>
                  <TableHead>所属项目</TableHead>
                  <TableHead>分析类型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>分析负责人</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <ClickableRow key={task.id} href={viewHref(task.id)} scroll={false}>
                    <TableCell>
                      <Link href={viewHref(task.id)} scroll={false} className="font-medium hover:underline">
                        {task.taskNo}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/experiment-tasks/${task.experimentTask.id}`} className="hover:underline">
                        {task.experimentTask.taskNo}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/projects/${task.project.id}`} className="hover:underline">
                        {task.project.projectNo}
                      </Link>
                    </TableCell>
                    <TableCell>{task.analysisType ?? "-"}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <StatusDot className={BIOINFO_TASK_STATUS_DOT[task.status as BioinfoTaskStatusValue]} />
                        {BIOINFO_TASK_STATUS_LABELS[task.status as BioinfoTaskStatusValue]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <UserCell user={task.analyst} />
                    </TableCell>
                    <TableCell className="text-right">
                      <BioinfoTaskActionMenu
                        taskId={task.id}
                        taskNo={task.taskNo}
                        status={task.status as BioinfoTaskStatusValue}
                        role={role}
                        analysisType={task.analysisType}
                        compact
                      />
                    </TableCell>
                  </ClickableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ListPager total={total} page={page} totalPages={totalPages} noun="任务" hrefFor={pageHref} />
        </>
      )}
    </>
  )
}

// —— 待建：已完成、待建生信任务的 ExperimentTask（行内深链建任务） ——
function PendingTab({
  tasks,
  total,
  page,
  limit,
  q,
  canCreate,
}: {
  tasks: Awaited<ReturnType<typeof listExperimentTasks>>["data"]
  total: number
  page: number
  limit: number
  q?: string
  canCreate: boolean
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams()
    params.set("tab", "pending")
    if (q) params.set("q", q)
    params.set("page", String(nextPage))
    params.set("limit", String(limit))
    return `/bioinfo-tasks?${params.toString()}`
  }
  const hasActiveFilters = Boolean(q)

  return (
    <>
      <ListToolbar
        basePath="/bioinfo-tasks"
        searchPlaceholder="搜索实验任务编号 / 实验类型 / 样本 / 项目…"
        searchDefault={q}
      />

      {total === 0 ? (
        hasActiveFilters ? (
          <ListEmpty icon={<SearchX />} title="无匹配结果" description="当前搜索下没有待建生信任务。">
            <Button variant="outline" asChild>
              <Link href="/bioinfo-tasks?tab=pending">清除搜索</Link>
            </Button>
          </ListEmpty>
        ) : (
          <ListEmpty
            icon={<FlaskConical />}
            title="暂无待建生信任务"
            description="含生信服务的项目，其实验任务完成后会在此排队待建分析任务。"
          />
        )
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border bg-card transition-opacity group-has-[[data-pending]]/list:opacity-60">
            <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
              <TableHeader>
                <TableRow>
                  <TableHead>实验任务编号</TableHead>
                  <TableHead>关联样本</TableHead>
                  <TableHead>所属项目</TableHead>
                  <TableHead>实验类型</TableHead>
                  <TableHead>计划日期</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <ClickableRow key={task.id} href={`/experiment-tasks/${task.id}`}>
                    <TableCell>
                      <Link href={`/experiment-tasks/${task.id}`} className="font-medium hover:underline">
                        {task.taskNo}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {task.taskSamples.map((ts) => ts.sample.sampleName || "未命名").join("、") || "-"}
                    </TableCell>
                    <TableCell>
                      <Link href={`/projects/${task.project.id}`} className="hover:underline">
                        {task.project.projectNo}
                      </Link>
                    </TableCell>
                    <TableCell>{task.experimentType}</TableCell>
                    <TableCell>{formatDate(task.plannedDate)}</TableCell>
                    <TableCell className="text-right">
                      {canCreate ? (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/bioinfo-tasks?tab=pending&new=1&experimentTaskId=${task.id}`}>建生信任务</Link>
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">待生信建任务</span>
                      )}
                    </TableCell>
                  </ClickableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ListPager total={total} page={page} totalPages={totalPages} noun="待建任务" hrefFor={pageHref} />
        </>
      )}
    </>
  )
}
