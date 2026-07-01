import Link from "next/link"
import { FlaskConical, SearchX } from "lucide-react"
import { redirect } from "next/navigation"
import { getVerifiedSession } from "@/lib/auth/verified-session"
import { parsePagination } from "@/lib/api-utils"
import {
  EXPERIMENT_TASK_STATUS_LABELS,
  ExperimentTaskStatus,
  UserRole,
  type ExperimentTaskStatus as ExperimentTaskStatusValue,
  type UserRole as UserRoleValue,
} from "@/lib/enums"
import { buildProjectScope } from "@/lib/auth/role-scope"
import { prisma } from "@/lib/prisma"
import { experimentTaskListQuerySchema } from "@/lib/schemas/experiment-task"
import { canActAsStaff } from "@/lib/auth/action-roles"
import { getAnalystOptions } from "@/lib/bioinfo-tasks/options"
import { getOperatorOptions, getTaskSampleOptions } from "@/lib/experiment-tasks/options"
import { getExperimentTaskDetail, listExperimentTasks } from "@/lib/experiment-tasks/service"
import { listExperimentAppointmentBatches } from "@/lib/experiment-tasks/service"
import type {
  ExperimentScheduleAppointmentBatch,
  ExperimentScheduleTask,
} from "@/lib/experiment-tasks/lab-schedule"
import { cn, firstParam, formatDate, todayString, toDateString } from "@/lib/utils"
import { ClickableRow } from "@/components/list/clickable-row"
import { ListEmpty } from "@/components/list/list-empty"
import { ListPager } from "@/components/list/list-pager"
import { ListToolbar } from "@/components/list/list-toolbar"
import { WorkItemPanel, WorkItemPanelEmpty } from "@/components/detail/work-item-panel"
import { FormDialog } from "@/components/detail/form-dialog"
import { ExperimentTaskActionMenu } from "@/components/experiment-tasks/experiment-task-action-menu"
import { ExperimentTaskForm } from "@/components/experiment-tasks/experiment-task-form"
import { ExperimentScheduleBoard } from "@/components/experiment-tasks/experiment-schedule-board"
import { ExperimentTaskWorkItemBody } from "@/components/experiment-tasks/experiment-task-work-item-body"
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

type LabRange = "mine" | "pending" | "all"

const RANGE_LABELS: Record<LabRange, string> = {
  mine: "我的",
  pending: "待排期",
  all: "全部",
}

const RANGE_EMPTY: Record<LabRange, { title: string; description: string }> = {
  mine: {
    title: "暂无我的实验任务",
    description: "已指派给你的实验任务会出现在这里。",
  },
  pending: {
    title: "暂无待排期实验任务",
    description: "待预约批次统一在排期视图处理，任务列表只展示已创建的实验任务。",
  },
  all: {
    title: "暂无实验任务",
    description: "样本接收后，从排期视图按批次预约实验。",
  },
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

function parseRange(value: string | undefined, role: UserRoleValue): LabRange {
  if (value === "mine" || value === "pending" || value === "all") return value
  if (role === UserRole.lab_operator) return "mine"
  if (role === UserRole.viewer) return "all"
  return "pending"
}

export default async function LabPage({ searchParams }: LabPageProps) {
  const session = await getVerifiedSession()
  if (!session) redirect("/login")
  const role = session.user.role as UserRoleValue
  const operator = { id: session.user.id, role }
  const canCreate = canActAsStaff(role)

  const raw = (await searchParams) ?? {}
  const viewId = firstParam(raw.view)
  const range = parseRange(firstParam(raw.range), role)
  const isScheduleMode = range === "pending"
  const query = experimentTaskListQuerySchema.parse({
    q: firstParam(raw.q),
    range,
    status: firstParam(raw.status),
    projectId: firstParam(raw.projectId),
    operatorId: firstParam(raw.operatorId),
    date: firstParam(raw.date),
    plannedDate: firstParam(raw.plannedDate),
    awaiting: firstParam(raw.awaiting),
    page: firstParam(raw.page),
    limit: firstParam(raw.limit),
  })
  const { page, limit, skip } = parsePagination({ page: firstParam(raw.page), limit: firstParam(raw.limit) })

  // 状态多选：未显式勾选且非 awaiting 队列时默认隐藏终态。awaiting=bioinfo 队列自带 completed 语义，
  // 叠加"隐藏终态"会清空它，故此时不注入默认（让队列 where 决定状态集）。
  const hasStatusFilter = range !== "pending" && Boolean(query.status?.length)
  const useStatusDefault = range !== "pending" && !hasStatusFilter && !query.awaiting
  const selectedStatuses = range === "pending"
    ? undefined
    : hasStatusFilter
    ? (query.status as ExperimentTaskStatusValue[])
    : useStatusDefault
      ? DEFAULT_TASK_STATUS_SELECTION
      : undefined
  const effectiveQuery = {
    ...query,
    status: selectedStatuses,
    operatorId: range === "mine" || range === "pending" ? undefined : query.operatorId,
  }
  const scheduleQuery = {
    ...query,
    q: undefined,
    range: undefined,
    status: DEFAULT_TASK_STATUS_SELECTION,
    operatorId: undefined,
    date: undefined,
    plannedDate: undefined,
    awaiting: undefined,
  }
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
  const showAppointmentQueue = canCreate && isScheduleMode

  const [
    { data: tasks, total },
    contextProject,
    operatorOptions,
    analystOptions,
    { data: scheduleTaskRows },
    appointmentBatches,
    sampleOptions,
    viewDetail,
  ] = await Promise.all([
    isScheduleMode
      ? Promise.resolve({ data: [], total: 0 })
      : listExperimentTasks(operator, effectiveQuery, { skip, limit }),
    query.projectId
      ? prisma.project.findFirst({
          where: { AND: [{ id: query.projectId }, buildProjectScope(role)] },
          select: { projectNo: true },
        })
      : null,
    getOperatorOptions(),
    getAnalystOptions(),
    isScheduleMode
      ? listExperimentTasks(operator, scheduleQuery, { skip: 0, limit: 500 })
      : Promise.resolve({ data: [], total: 0 }),
    showAppointmentQueue
      ? listExperimentAppointmentBatches(role, {
          projectId: query.projectId,
          take: 20,
        })
      : Promise.resolve([]),
    isNew && canCreate
      ? getTaskSampleOptions(operator, {
          projectId: query.projectId,
          sampleBatchId: initialSampleBatchId,
        })
      : Promise.resolve([]),
    viewId ? getExperimentTaskDetail(operator, viewId).catch(() => null) : Promise.resolve(null),
  ])
  const scheduleTasks: ExperimentScheduleTask[] = scheduleTaskRows
    .filter((task) => task.plannedDate)
    .map((task) => ({
      id: task.id,
      taskNo: task.taskNo,
      projectNo: task.project.projectNo ?? "未编号项目",
      customerOrg: task.project.customerOrg,
      experimentType: task.experimentType,
      status: task.status,
      plannedDate: toDateString(task.plannedDate),
      operatorName: task.operator?.name ?? null,
      sampleNames: task.taskSamples.map((ts) => ts.sample.sampleName || "未命名"),
    }))

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const baseParams = new URLSearchParams()
  baseParams.set("range", range)
  for (const key of ["projectId", "date", "plannedDate", "awaiting"]) {
    const value = firstParam(raw[key])
    if (value) baseParams.set(key, value)
  }
  if (!isScheduleMode) {
    if (query.q) baseParams.set("q", query.q)
    if (hasStatusFilter && query.status?.length) {
      baseParams.set("status", query.status.join(","))
    }
    if (range === "all" && query.operatorId) baseParams.set("operatorId", query.operatorId)
  }
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams(baseParams)
    params.set("page", String(nextPage))
    params.set("limit", String(limit))
    return `/lab?${params.toString()}`
  }
  // ?view=<id> 工作区：保留当前筛选/页，叠加 view 参数
  const viewHref = (id: string) => {
    const params = new URLSearchParams(baseParams)
    if (page > 1) params.set("page", String(page))
    params.set("view", id)
    return `/lab?${params.toString()}`
  }
  const rangeHref = (nextRange: LabRange) => {
    const params = new URLSearchParams()
    params.set("range", nextRange)
    if (query.projectId) params.set("projectId", query.projectId)
    if (nextRange === "pending" && query.plannedDate) {
      params.set("plannedDate", query.plannedDate)
    }
    return `/lab?${params.toString()}`
  }
  const scheduleAppointmentBatches: ExperimentScheduleAppointmentBatch[] = appointmentBatches.map(
    (batch) => ({
      id: batch.id,
      batchNo: batch.batchNo,
      projectId: batch.project.id,
      projectNo: batch.project.projectNo ?? "未编号项目",
      customerOrg: batch.project.customerOrg,
      experimentType: batch.experimentType,
      receivedAt: batch.receivedAt ? toDateString(batch.receivedAt) : null,
      sampleCount: batch.appointmentSampleCount,
    })
  )
  // ?sampleBatchId= 命中时，自动默认选中该批次所有未上机样本（picker 默认「YP 全选」）
  const prefilledSampleIds =
    initialSampleIds.length > 0
      ? initialSampleIds
      : initialSampleBatchId
        ? sampleOptions.map((s) => s.id)
        : []
  // projectId 是上下文不是筛选，不参与「无匹配结果」判定；date 由工位链接带入，视作筛选
  const hasActiveFilters = Boolean(query.q || hasStatusFilter || query.date || query.plannedDate)
  const clearParams = new URLSearchParams()
  clearParams.set("range", range)
  if (query.projectId) clearParams.set("projectId", query.projectId)
  const clearFiltersHref = clearParams.size ? `/lab?${clearParams.toString()}` : "/lab"
  const selectedScheduleDate = query.plannedDate ?? (query.date === "today" ? todayString() : undefined)

  return (
    <div className="group/list flex flex-1 flex-col gap-4 p-4 md:p-6">
      <h1 className="sr-only">实验</h1>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border bg-background p-0.5">
          {(Object.keys(RANGE_LABELS) as LabRange[]).map((value) => (
            <Link
              key={value}
              href={rangeHref(value)}
              aria-current={range === value ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center rounded-sm px-3 text-sm font-medium transition-colors",
                range === value
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {RANGE_LABELS[value]}
            </Link>
          ))}
        </div>
      </div>

      {!isScheduleMode && (
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
        />
      )}

      {isScheduleMode ? (
        <ExperimentScheduleBoard
          tasks={scheduleTasks}
          appointmentBatches={scheduleAppointmentBatches}
          selectedDate={selectedScheduleDate}
          canCreate={canCreate}
        />
      ) : total === 0 ? (
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
            title={query.projectId ? "该项目暂无实验任务" : RANGE_EMPTY[range].title}
            description={
              query.projectId
                ? "样本接收后，从排期视图按批次预约实验。"
                : RANGE_EMPTY[range].description
            }
          />
        )
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border bg-card transition-opacity group-has-[[data-pending]]/list:opacity-60">
            <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
              <TableHeader>
                <TableRow>
                  <TableHead>任务编号</TableHead>
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
                          workItemHref={viewHref(task.id)}
                          compact
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
        <WorkItemPanel
          title={viewDetail ? `实验任务 ${viewDetail.task.taskNo}` : "实验任务详情"}
        >
          {viewDetail ? (
            <ExperimentTaskWorkItemBody
              detail={viewDetail}
              role={session.user.role}
              operatorOptions={operatorOptions}
              analystOptions={analystOptions}
            />
          ) : (
            <WorkItemPanelEmpty message="实验任务不存在或无权限查看。" />
          )}
        </WorkItemPanel>
      )}

      {isNew && canCreate && (
        <FormDialog
          param="new"
          title={
            initialSampleBatchId
              ? "预约实验 · 已预选批次"
              : prefilledSampleIds.length > 0
                ? `预约实验 · 已预选 ${prefilledSampleIds.length} 个样本`
              : "新建实验任务"
          }
        >
          <ExperimentTaskForm
            mode="create"
            surface="modal"
            sampleOptions={sampleOptions}
            operatorOptions={operatorOptions}
            initialSampleIds={prefilledSampleIds}
            initialPlannedDate={query.plannedDate}
          />
        </FormDialog>
      )}
    </div>
  )
}
