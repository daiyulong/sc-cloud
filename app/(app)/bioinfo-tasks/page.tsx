import Link from "next/link"
import { Dna, SearchX } from "lucide-react"
import { redirect } from "next/navigation"
import { firstParam } from "@/lib/utils"
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
import { ANALYST_UNASSIGNED, bioinfoTaskListQuerySchema } from "@/lib/schemas/bioinfo-task"
import { getAnalystOptions } from "@/lib/bioinfo-tasks/options"
import { getBioinfoTaskDetail, listBioinfoTasks } from "@/lib/bioinfo-tasks/service"
import { ClickableRow } from "@/components/list/clickable-row"
import { ListEmpty } from "@/components/list/list-empty"
import { ListPager } from "@/components/list/list-pager"
import { ListToolbar } from "@/components/list/list-toolbar"
import { WorkItemPanel, WorkItemPanelEmpty } from "@/components/detail/work-item-panel"
import { BioinfoTaskActionMenu } from "@/components/bioinfo-tasks/bioinfo-task-action-menu"
import { BioinfoTaskWorkItemBody } from "@/components/bioinfo-tasks/bioinfo-task-work-item-body"
import { BIOINFO_TASK_STATUS_DOT, StatusDot } from "@/components/status-dot"
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

type BioinfoTasksPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

// 默认列表隐藏终态，避免日常工位被已交付/异常记录淹没；显式状态筛选仍可查看。
const TERMINAL_BIOINFO_STATUSES: BioinfoTaskStatusValue[] = [
  BioinfoTaskStatus.delivered,
  BioinfoTaskStatus.abnormal,
]
const DEFAULT_BIOINFO_STATUS_SELECTION: BioinfoTaskStatusValue[] = (
  Object.values(BioinfoTaskStatus) as BioinfoTaskStatusValue[]
).filter((status) => !TERMINAL_BIOINFO_STATUSES.includes(status))

export default async function BioinfoTasksPage({ searchParams }: BioinfoTasksPageProps) {
  const session = await getVerifiedSession()
  if (!session) redirect("/login")
  const role = session.user.role as UserRoleValue
  const operator = { id: session.user.id, role }

  const raw = (await searchParams) ?? {}
  const viewId = firstParam(raw.view)
  const { page, limit, skip } = parsePagination({
    page: firstParam(raw.page),
    limit: firstParam(raw.limit),
  })

  const query = bioinfoTaskListQuerySchema.parse({
    q: firstParam(raw.q),
    status: firstParam(raw.status),
    projectId: firstParam(raw.projectId),
    analystId: firstParam(raw.analystId),
    open: firstParam(raw.open),
    page: firstParam(raw.page),
    limit: firstParam(raw.limit),
  })

  const hasStatusFilter = Boolean(query.status?.length)
  const useStatusDefault = !hasStatusFilter && !query.open
  const selectedStatuses = hasStatusFilter
    ? (query.status as BioinfoTaskStatusValue[])
    : useStatusDefault
      ? DEFAULT_BIOINFO_STATUS_SELECTION
      : undefined
  const effectiveQuery = { ...query, status: selectedStatuses }

  const [{ data: tasks, total }, contextProject] = await Promise.all([
    listBioinfoTasks(operator, effectiveQuery, { skip, limit }),
    query.projectId
      ? prisma.project.findFirst({
          where: { AND: [{ id: query.projectId }, buildProjectScope(role)] },
          select: { projectNo: true },
        })
      : null,
  ])

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const baseParams = new URLSearchParams()
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
  const viewHref = (id: string) => {
    const params = new URLSearchParams(baseParams)
    if (page > 1) params.set("page", String(page))
    params.set("view", id)
    return `/bioinfo-tasks?${params.toString()}`
  }
  const clearFiltersHref = query.projectId
    ? `/bioinfo-tasks?projectId=${query.projectId}`
    : "/bioinfo-tasks"
  const hasActiveFilters = Boolean(query.q || hasStatusFilter || query.open || query.analystId)

  const [viewDetail, analystOptions] = await Promise.all([
    viewId ? getBioinfoTaskDetail(operator, viewId).catch(() => null) : Promise.resolve(null),
    getAnalystOptions(),
  ])

  return (
    <div className="group/list flex flex-1 flex-col gap-4 p-4 md:p-6">
      <h1 className="sr-only">生信</h1>

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
            value: (selectedStatuses ?? []).join(","),
            options: Object.values(BioinfoTaskStatus).map((value) => ({
              value,
              label: BIOINFO_TASK_STATUS_LABELS[value],
              dot: BIOINFO_TASK_STATUS_DOT[value],
            })),
          },
          {
            key: "analystId",
            label: "分析负责人",
            allLabel: "全部负责人",
            value: query.analystId ?? "",
            options: [
              { value: ANALYST_UNASSIGNED, label: "未分配" },
              ...analystOptions.map((analyst) => ({
                value: analyst.id,
                label: analyst.name,
              })),
            ],
          },
        ]}
        context={
          query.projectId
            ? {
                label: `项目：${contextProject?.projectNo ?? query.projectId}`,
                clearKeys: ["projectId"],
              }
            : undefined
        }
      />

      {total === 0 ? (
        hasActiveFilters ? (
          <ListEmpty
            icon={<SearchX />}
            title="无匹配结果"
            description="当前筛选条件下没有生信任务，调整或清除筛选后重试。"
          >
            <Button variant="outline" asChild>
              <Link href={clearFiltersHref}>清除筛选</Link>
            </Button>
          </ListEmpty>
        ) : (
          <ListEmpty
            icon={<Dna />}
            title="暂无生信任务"
            description="含生信服务的项目在实验反馈完成后，会自动生成生信任务。"
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
                      <Link
                        href={viewHref(task.id)}
                        scroll={false}
                        className="font-medium hover:underline"
                      >
                        {task.taskNo}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/lab?projectId=${task.project.id}&view=${task.experimentTask.id}`}
                        className="hover:underline"
                      >
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
                        <StatusDot
                          className={BIOINFO_TASK_STATUS_DOT[task.status as BioinfoTaskStatusValue]}
                        />
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
                        role={session.user.role}
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

      {viewId && (
        <WorkItemPanel
          title={viewDetail ? `生信任务 ${viewDetail.task.taskNo}` : "生信任务详情"}
        >
          {viewDetail ? (
            <BioinfoTaskWorkItemBody
              detail={viewDetail}
              role={session.user.role}
              analystOptions={analystOptions}
            />
          ) : (
            <WorkItemPanelEmpty message="生信任务不存在或无权限查看。" />
          )}
        </WorkItemPanel>
      )}
    </div>
  )
}
