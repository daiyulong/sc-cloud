import Link from "next/link"
import { Dna, Plus, SearchX } from "lucide-react"
import { redirect } from "next/navigation"
import { firstParam } from "@/lib/utils"
import { auth } from "@/lib/auth"
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
import { bioinfoCreateRoles } from "@/lib/bioinfo-tasks/rules"
import { listBioinfoTasks } from "@/lib/bioinfo-tasks/service"
import { ClickableRow } from "@/components/list/clickable-row"
import { ListEmpty } from "@/components/list/list-empty"
import { ListToolbar } from "@/components/list/list-toolbar"
import { BioinfoTaskActionMenu } from "@/components/bioinfo-tasks/bioinfo-task-action-menu"
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

export default async function BioinfoTasksPage({ searchParams }: BioinfoTasksPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const role = session.user.role as UserRoleValue
  const operator = { id: session.user.id, role }

  const raw = (await searchParams) ?? {}
  const query = bioinfoTaskListQuerySchema.parse({
    q: firstParam(raw.q),
    status: firstParam(raw.status),
    projectId: firstParam(raw.projectId),
    analystId: firstParam(raw.analystId),
    open: firstParam(raw.open),
    page: firstParam(raw.page),
    limit: firstParam(raw.limit),
  })
  const { page, limit, skip } = parsePagination({ page: firstParam(raw.page), limit: firstParam(raw.limit) })
  const [{ data: tasks, total }, contextProject] = await Promise.all([
    listBioinfoTasks(operator, query, { skip, limit }),
    query.projectId
      ? prisma.project.findFirst({
          where: { AND: [{ id: query.projectId }, buildProjectScope(role, operator.id)] },
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
  const canCreate = bioinfoCreateRoles.includes(role as (typeof bioinfoCreateRoles)[number])
  const hasActiveFilters = Boolean(query.q || query.status || query.open)
  const clearFiltersHref = query.projectId
    ? `/bioinfo-tasks?projectId=${query.projectId}`
    : "/bioinfo-tasks"

  return (
    <div className="group/list flex flex-1 flex-col gap-4 p-4 md:p-6">
      <h1 className="sr-only">生信分析</h1>
      <ListToolbar
        basePath="/bioinfo-tasks"
        searchPlaceholder="搜索任务编号 / 分析类型 / 实验任务 / 项目…"
        searchDefault={query.q}
        filters={[
          {
            key: "status",
            label: "分析状态",
            allLabel: "全部状态",
            value: query.status,
            options: Object.values(BioinfoTaskStatus).map((value) => ({
              value,
              label: BIOINFO_TASK_STATUS_LABELS[value],
              dot: BIOINFO_TASK_STATUS_DOT[value],
            })),
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
      >
        {canCreate && (
          <Button asChild>
            <Link href="/bioinfo-tasks/new">
              <Plus data-icon="inline-start" aria-hidden="true" />
              新建任务
            </Link>
          </Button>
        )}
      </ListToolbar>

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
            title={query.projectId ? "该项目暂无生信任务" : "暂无生信任务"}
            description="实验任务完成后，从实验任务创建生信分析任务（仅含生信服务的项目）。"
          >
            {canCreate && (
              <Button asChild>
                <Link href="/bioinfo-tasks/new">
                  <Plus data-icon="inline-start" aria-hidden="true" />
                  新建任务
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

          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              共 {total} 个任务 · 第 {page} / {totalPages} 页
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
