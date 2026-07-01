import Link from "next/link"
import { CalendarClock, FlaskConical, SearchX } from "lucide-react"
import { redirect } from "next/navigation"
import { getVerifiedSession } from "@/lib/auth/verified-session"
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
import { getAnalystOptions } from "@/lib/bioinfo-tasks/options"
import { getOperatorOptions, getTaskSampleOptions } from "@/lib/experiment-tasks/options"
import {
  getExperimentTaskDetail,
  listExperimentAppointmentBatches,
  listExperimentTasks,
} from "@/lib/experiment-tasks/service"
import type {
  ExperimentScheduleAppointmentBatch,
  ExperimentScheduleTask,
} from "@/lib/experiment-tasks/lab-schedule"
import { firstParam, formatDate, todayString, toDateString } from "@/lib/utils"
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

// 任务终态：默认浏览队列时隐藏（多选状态默认勾选其余在途态）。搜索或显式勾选则照常显示。
// 与 /projects /bioinfo-tasks /intake 用同一套约定（ListToolbar 多选状态过滤），
// 见 ADR-0003 "彻底revert：状态 Tab/桶系统撤销" —— 这套多选过滤从未坏过，
// 不该被替换。
const TERMINAL_TASK_STATUSES: ExperimentTaskStatusValue[] = [
  ExperimentTaskStatus.completed,
  ExperimentTaskStatus.cancelled,
  ExperimentTaskStatus.abnormal,
]
const DEFAULT_TASK_STATUS_SELECTION: ExperimentTaskStatusValue[] = (
  Object.values(ExperimentTaskStatus) as ExperimentTaskStatusValue[]
).filter((status) => !TERMINAL_TASK_STATUSES.includes(status))

export default async function LabPage({ searchParams }: LabPageProps) {
  const session = await getVerifiedSession()
  if (!session) redirect("/login")
  const role = session.user.role as UserRoleValue
  const operator = { id: session.user.id, role }
  const canCreate = canActAsStaff(role)

  const raw = (await searchParams) ?? {}
  const viewId = firstParam(raw.view)
  // 「排期」是与状态过滤正交的独立工具（日历规划 + 按批次预约新任务），
  // 用 ?mode=schedule 单独标志位触发，不与状态多选混在一起（见 ADR-0003）。
  const isScheduleMode = firstParam(raw.mode) === "schedule"
  const query = experimentTaskListQuerySchema.parse({
    q: firstParam(raw.q),
    status: firstParam(raw.status),
    projectId: firstParam(raw.projectId),
    operatorId: firstParam(raw.operatorId),
    date: firstParam(raw.date),
    plannedDate: firstParam(raw.plannedDate),
    awaiting: firstParam(raw.awaiting),
    mode: firstParam(raw.mode),
    page: firstParam(raw.page),
    limit: firstParam(raw.limit),
  })
  const { page, limit, skip } = parsePagination({ page: firstParam(raw.page), limit: firstParam(raw.limit) })

  // 状态多选：未显式勾选且非 awaiting 队列时默认隐藏终态。awaiting=bioinfo 队列自带 completed 语义，
  // 叠加"隐藏终态"会清空它，故此时不注入默认（让队列 where 决定状态集）。
  const hasStatusFilter = !isScheduleMode && Boolean(query.status?.length)
  const useStatusDefault = !isScheduleMode && !hasStatusFilter && !query.awaiting
  const selectedStatuses = isScheduleMode
    ? undefined
    : hasStatusFilter
    ? (query.status as ExperimentTaskStatusValue[])
    : useStatusDefault
      ? DEFAULT_TASK_STATUS_SELECTION
      : undefined
  const effectiveQuery = { ...query, status: selectedStatuses }
  const scheduleQuery = {
    ...query,
    q: undefined,
    status: DEFAULT_TASK_STATUS_SELECTION,
    operatorId: undefined,
    date: undefined,
    plannedDate: undefined,
    awaiting: undefined,
    mode: undefined,
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
      sampleNames: task.taskSamples
        .map((ts) => ts.sample.sampleName?.trim() ?? "")
        .filter((name) => name.length > 0),
      sampleCount: task.taskSamples.length,
    }))

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const baseParams = new URLSearchParams()
  for (const key of ["projectId", "date", "plannedDate", "awaiting"]) {
    const value = firstParam(raw[key])
    if (value) baseParams.set(key, value)
  }
  if (!isScheduleMode) {
    if (query.q) baseParams.set("q", query.q)
    if (hasStatusFilter && query.status?.length) {
      baseParams.set("status", query.status.join(","))
    }
    if (query.operatorId) baseParams.set("operatorId", query.operatorId)
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
  // 「排期」入口：保留当前 projectId 等上下文 + 当前 plannedDate（日历选中日跟着走）。
  const scheduleModeHref = () => {
    const params = new URLSearchParams(baseParams)
    params.set("mode", "schedule")
    if (query.plannedDate) params.set("plannedDate", query.plannedDate)
    return `/lab?${params.toString()}`
  }
  // 从排期返回任务列表：去掉 mode，同时去掉 plannedDate（避免带着排期选中日
  // 回到列表却没有任何可见提示，见 ADR-0003）。
  const listModeHref = () => {
    const params = new URLSearchParams(baseParams)
    params.delete("mode")
    params.delete("plannedDate")
    const qs = params.toString()
    return qs ? `/lab?${qs}` : "/lab"
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
  if (query.projectId) clearParams.set("projectId", query.projectId)
  const clearFiltersHref = clearParams.size ? `/lab?${clearParams.toString()}` : "/lab"
  const selectedScheduleDate = query.plannedDate ?? (query.date === "today" ? todayString() : undefined)

  return (
    <div className="group/list flex flex-1 flex-col gap-4 p-4 md:p-6">
      <h1 className="sr-only">实验</h1>

      {isScheduleMode ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">按批次预约实验、查看近期负载</p>
          <Button asChild variant="outline" size="sm">
            <Link href={listModeHref()} prefetch={false}>
              返回任务列表
            </Link>
          </Button>
        </div>
      ) : (
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
          <Button asChild variant="outline" size="sm">
            <Link href={scheduleModeHref()} prefetch={false}>
              <CalendarClock data-icon="inline-start" aria-hidden="true" />
              排期看板
            </Link>
          </Button>
        </ListToolbar>
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
            title={query.projectId ? "该项目暂无实验任务" : "暂无实验任务"}
            description={
              query.projectId
                ? "样本接收后，点击「排期看板」按批次预约实验。"
                : "样本接收后，点击「排期看板」按批次预约实验。"
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
