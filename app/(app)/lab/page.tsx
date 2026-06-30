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
import { canActAsStaff } from "@/lib/auth/action-roles"
import { getOperatorOptions, getTaskSampleOptions } from "@/lib/experiment-tasks/options"
import { getExperimentTaskDetail, listExperimentTasks } from "@/lib/experiment-tasks/service"
import { firstParam, formatDate } from "@/lib/utils"
import { ClickableRow } from "@/components/list/clickable-row"
import { ListEmpty } from "@/components/list/list-empty"
import { ListPager } from "@/components/list/list-pager"
import { ListToolbar } from "@/components/list/list-toolbar"
import { DetailSheet, DetailSheetEmpty } from "@/components/detail/detail-sheet"
import { FormDialog } from "@/components/detail/form-dialog"
import { ExperimentTaskActionMenu } from "@/components/experiment-tasks/experiment-task-action-menu"
import { ExperimentTaskForm } from "@/components/experiment-tasks/experiment-task-form"
import { ExperimentTaskSheetBody } from "@/components/experiment-tasks/experiment-task-sheet-body"
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

// 任务终态：默认浏览队列时隐藏（多选状态默认勾选其余在途态）。搜索或显式勾选则照常显示。
const TERMINAL_TASK_STATUSES: ExperimentTaskStatusValue[] = [
  ExperimentTaskStatus.completed,
  ExperimentTaskStatus.cancelled,
  ExperimentTaskStatus.abnormal,
]
const DEFAULT_TASK_STATUS_SELECTION: ExperimentTaskStatusValue[] = (
  Object.values(ExperimentTaskStatus) as ExperimentTaskStatusValue[]
).filter((status) => !TERMINAL_TASK_STATUSES.includes(status))

export default async function LabPage({ searchParams }: LabPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const role = session.user.role as UserRoleValue
  const operator = { id: session.user.id, role }

  const raw = (await searchParams) ?? {}
  const viewId = firstParam(raw.view)
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

  // 状态多选：未显式勾选且非 awaiting 队列时默认隐藏终态。awaiting=bioinfo 队列自带 completed 语义，
  // 叠加"隐藏终态"会清空它，故此时不注入默认（让队列 where 决定状态集）。
  const hasStatusFilter = Boolean(query.status?.length)
  const useStatusDefault = !hasStatusFilter && !query.awaiting
  const selectedStatuses = hasStatusFilter
    ? (query.status as ExperimentTaskStatusValue[])
    : useStatusDefault
      ? DEFAULT_TASK_STATUS_SELECTION
      : undefined
  const effectiveQuery = { ...query, status: selectedStatuses }

  const [{ data: tasks, total }, contextProject, operatorOptions] = await Promise.all([
    listExperimentTasks(operator, effectiveQuery, { skip, limit }),
    query.projectId
      ? prisma.project.findFirst({
          where: { AND: [{ id: query.projectId }, buildProjectScope(role)] },
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
  // ?view=<id> 抽屉：保留当前筛选/页，叠加 view 参数
  const viewHref = (id: string) => {
    const params = new URLSearchParams(baseParams)
    if (page > 1) params.set("page", String(page))
    params.set("view", id)
    return `/lab?${params.toString()}`
  }
  const viewDetail = viewId
    ? await getExperimentTaskDetail(operator, viewId).catch(() => null)
    : null
  // ?new=1 模态：在队列里建任务（成功后关模态回列表、不跳全页）
  const isNew = firstParam(raw.new) === "1"
  // 多对多入口预填：支持 ?sampleIds=id1,id2,id3（新建 task 覆盖 N 个样本）；?sampleBatchId= 自动全选该批次
  const initialSampleIds = (() => {
    const rawIds = firstParam(raw.sampleIds)
    if (rawIds) return rawIds.split(",").filter(Boolean)
    // 向后兼容：旧 URL ?sampleId= 单数也认作「预填 1 个」
    const legacy = firstParam(raw.sampleId)
    return legacy ? [legacy] : []
  })()
  const initialSampleBatchId = firstParam(raw.sampleBatchId)
  const newHref = (() => {
    const params = new URLSearchParams(baseParams)
    if (page > 1) params.set("page", String(page))
    params.set("new", "1")
    return `/lab?${params.toString()}`
  })()
  const canCreate = canActAsStaff(role)
  const sampleOptions =
    isNew && canCreate
      ? await getTaskSampleOptions(operator, {
          projectId: query.projectId,
          sampleBatchId: initialSampleBatchId,
        })
      : []
  // ?sampleBatchId= 命中时，自动默认选中该批次所有未上机样本（picker 默认「YP 全选」）
  const prefilledSampleIds =
    initialSampleIds.length > 0
      ? initialSampleIds
      : initialSampleBatchId
        ? sampleOptions.map((s) => s.id)
        : []
  // projectId 是上下文不是筛选，不参与「无匹配结果」判定；date 由工位链接带入，视作筛选
  const hasActiveFilters = Boolean(query.q || hasStatusFilter || query.date)
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
            multiple: true,
            value: (selectedStatuses ?? []).join(","),
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
            <Link href={newHref}>
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
            title={
              query.projectId
                ? "该项目暂无实验任务"
                : useStatusDefault
                  ? "暂无在途实验任务"
                  : "暂无实验任务"
            }
            description={
              useStatusDefault
                ? "默认仅显示在途状态。点上方「任务状态」可查看含已完成等终态的全部。"
                : "样本接收后，由项目经理或实验执行员从样本创建实验任务。"
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

          <ListPager total={total} page={page} totalPages={totalPages} noun="任务" hrefFor={pageHref} />
        </>
      )}

      {viewId && (
        <DetailSheet title={viewDetail ? `实验任务 ${viewDetail.task.taskNo}` : "实验任务详情"}>
          {viewDetail ? (
            <ExperimentTaskSheetBody
              detail={viewDetail}
              role={session.user.role}
              operatorOptions={operatorOptions}
            />
          ) : (
            <DetailSheetEmpty message="实验任务不存在或无权限查看。" />
          )}
        </DetailSheet>
      )}

      {isNew && canCreate && (
        <FormDialog
          param="new"
          title={
            prefilledSampleIds.length > 0
              ? `新建实验任务 · 已预选 ${prefilledSampleIds.length} 个样本`
              : "新建实验任务"
          }
        >
          <ExperimentTaskForm
            mode="create"
            surface="modal"
            sampleOptions={sampleOptions}
            operatorOptions={operatorOptions}
            initialSampleIds={prefilledSampleIds}
          />
        </FormDialog>
      )}
    </div>
  )
}
