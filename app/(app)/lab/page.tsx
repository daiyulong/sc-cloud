import Link from "next/link"
import { FlaskConical, Plus, SearchX } from "lucide-react"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { parsePagination } from "@/lib/api-utils"
import {
  EXPERIMENT_TASK_STATUS_LABELS,
  ExperimentTaskStatus,
  type ExperimentTaskStatus as ExperimentTaskStatusValue,
  type UserRole as UserRoleValue,
} from "@/lib/enums"
import { buildProjectScope } from "@/lib/auth/role-scope"
import { prisma } from "@/lib/prisma"
import { experimentTaskListQuerySchema } from "@/lib/schemas/experiment-task"
import { experimentManageRoles } from "@/lib/experiment-tasks/rules"
import { getOperatorOptions } from "@/lib/experiment-tasks/options"
import { listExperimentTasks } from "@/lib/experiment-tasks/service"
import { firstParam, formatDate } from "@/lib/utils"
import { ClickableRow } from "@/components/list/clickable-row"
import { ListEmpty } from "@/components/list/list-empty"
import { ListToolbar } from "@/components/list/list-toolbar"
import { ExperimentTaskActionMenu } from "@/components/experiment-tasks/experiment-task-action-menu"
import { EXPERIMENT_TASK_STATUS_DOT, StatusDot } from "@/components/status-dot"
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

type LabPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function LabPage({ searchParams }: LabPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const role = session.user.role as UserRoleValue
  const operator = { id: session.user.id, role }

  const raw = (await searchParams) ?? {}
  const query = experimentTaskListQuerySchema.parse({
    q: firstParam(raw.q),
    status: firstParam(raw.status),
    projectId: firstParam(raw.projectId),
    operatorId: firstParam(raw.operatorId),
    date: firstParam(raw.date),
    awaiting: firstParam(raw.awaiting),
    page: firstParam(raw.page),
    limit: firstParam(raw.limit),
  })
  const { page, limit, skip } = parsePagination({ page: firstParam(raw.page), limit: firstParam(raw.limit) })
  const [{ data: tasks, total }, contextProject, operatorOptions] = await Promise.all([
    listExperimentTasks(operator, query, { skip, limit }),
    query.projectId
      ? prisma.project.findFirst({
          where: { AND: [{ id: query.projectId }, buildProjectScope(role, operator.id)] },
          select: { projectNo: true },
        })
      : null,
    getOperatorOptions(),
  ])

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const baseParams = new URLSearchParams()
  for (const key of ["q", "status", "projectId", "operatorId", "date", "awaiting"]) {
    const value = firstParam(raw[key])
    if (value) baseParams.set(key, value)
  }
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams(baseParams)
    params.set("page", String(nextPage))
    params.set("limit", String(limit))
    return `/lab?${params.toString()}`
  }
  const canCreate = experimentManageRoles.includes(role as (typeof experimentManageRoles)[number])
  // projectId 是上下文不是筛选，不参与「无匹配结果」判定；date 由工位链接带入，视作筛选
  const hasActiveFilters = Boolean(query.q || query.status || query.date)
  const clearFiltersHref = query.projectId
    ? `/lab?projectId=${query.projectId}`
    : "/lab"

  return (
    <div className="group/list flex flex-1 flex-col gap-4 p-4 md:p-6">
      <h1 className="sr-only">实验</h1>
      <ListToolbar
        basePath="/lab"
        searchPlaceholder="搜索任务编号 / 实验类型 / 上机方式 / 样本 / 项目…"
        searchDefault={query.q}
        filters={[
          {
            key: "status",
            label: "任务状态",
            allLabel: "全部状态",
            value: query.status,
            options: Object.values(ExperimentTaskStatus).map((value) => ({
              value,
              label: EXPERIMENT_TASK_STATUS_LABELS[value],
              dot: EXPERIMENT_TASK_STATUS_DOT[value],
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
            <Link href="/experiment-tasks/new">
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
            description="当前筛选条件下没有实验任务，调整或清除筛选后重试。"
          >
            <Button variant="outline" asChild>
              <Link href={clearFiltersHref}>清除筛选</Link>
            </Button>
          </ListEmpty>
        ) : (
          <ListEmpty
            icon={<FlaskConical />}
            title={query.projectId ? "该项目暂无实验任务" : "暂无实验任务"}
            description="样本接收后，由项目经理或实验执行员从样本创建实验任务。"
          >
            {canCreate && (
              <Button asChild>
                <Link href="/experiment-tasks/new">
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
                  <TableHead>关联样本</TableHead>
                  <TableHead>所属项目</TableHead>
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
                    <TableCell>
                      <Link href={`/projects/${task.project.id}`} className="hover:underline">
                        {task.project.projectNo}
                      </Link>
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
                    <TableCell>
                      <UserCell user={task.operator} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <ExperimentTaskActionMenu
                          taskId={task.id}
                          taskNo={task.taskNo}
                          status={task.status as ExperimentTaskStatusValue}
                          role={session.user.role}
                          operatorOptions={operatorOptions}
                          compact
                          surface="sheet"
                        />
                      </div>
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
