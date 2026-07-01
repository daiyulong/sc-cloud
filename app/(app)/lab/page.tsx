import Link from "next/link"
import { CalendarClock, FlaskConical, SearchX } from "lucide-react"
import { redirect } from "next/navigation"
import { getVerifiedSession } from "@/lib/auth/verified-session"
import { parsePagination } from "@/lib/api-utils"
import {
  EXPERIMENT_TASK_STATUS_LABELS,
  type ExperimentTaskStatus as ExperimentTaskStatusValue,
  type UserRole as UserRoleValue,
} from "@/lib/enums"
import { buildProjectScope } from "@/lib/auth/role-scope"
import { EXPERIMENT_TASK_BUCKETS, statusesInBucket } from "@/lib/workstation-buckets"
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
import { firstParam, formatDate, todayString, toDateString } from "@/lib/utils"
import { ClickableRow } from "@/components/list/clickable-row"
import { ListEmpty } from "@/components/list/list-empty"
import { ListPager } from "@/components/list/list-pager"
import { ListTabs } from "@/components/list/list-tabs"
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

type LabTab = "todo" | "doing" | "done"

const TAB_EMPTY: Record<LabTab, { title: string; description: string }> = {
  todo: {
    title: "暂无待办实验任务",
    description: "还没有日期的实验任务会出现这里；按批次预约实验请点上方「排期」标签。",
  },
  doing: {
    title: "暂无进行中的实验任务",
    description: "已排期 / 进行中 / 待反馈 的任务会出现这里,可点击进入处理。",
  },
  done: {
    title: "暂无已完成实验任务",
    description: "已完成 / 已取消 / 已异常 的任务会出现这里。",
  },
}

function parseTab(value: string | undefined): LabTab | undefined {
  return value === "todo" || value === "doing" || value === "done" ? value : undefined
}

// 排期模式日历需要"未结束"的任务(待办+进行中两桶)做负载/日程展示，
// 不属于任何一个状态 Tab，直接从桶映射派生，避免维护第二份终态清单。
const NON_TERMINAL_TASK_STATUSES: ExperimentTaskStatusValue[] = [
  ...statusesInBucket(EXPERIMENT_TASK_BUCKETS, "todo"),
  ...statusesInBucket(EXPERIMENT_TASK_BUCKETS, "doing"),
]

export default async function LabPage({ searchParams }: LabPageProps) {
  const session = await getVerifiedSession()
  if (!session) redirect("/login")
  const role = session.user.role as UserRoleValue
  const operator = { id: session.user.id, role }
  const canCreate = canActAsStaff(role)

  const raw = (await searchParams) ?? {}
  const viewId = firstParam(raw.view)
  const tab = parseTab(firstParam(raw.tab)) ?? "doing"
  const isScheduleMode = firstParam(raw.mode) === "schedule"
  const query = experimentTaskListQuerySchema.parse({
    q: firstParam(raw.q),
    tab,
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

  // 状态由 tab 桶决定(lib/workstation-buckets.ts,service 层应用)，
  // 这里不再叠加任何默认状态注入 —— 之前的"默认隐藏终态"清单与桶重复且会打架
  // (如 tab=done 时桶=[completed,cancelled,abnormal]，再注入"非终态默认"会
  // 与桶取交集得空集，导致"已完成"Tab 恒为空)。?status= / ?operatorId= 仍保留
  // 为可选的深链接叠加过滤，不在 UI 暴露(见 ADR-0003 "我的/团队" 移除记录:
  // 这是内部全员可见的小团队工具，个人/团队视角切换的实际价值低于其带来的
  // 界面复杂度，真出现"按负责人查"的需求再加，不预先猜)。
  const effectiveQuery = query
  const scheduleQuery = {
    ...query,
    q: undefined,
    tab: undefined,
    status: NON_TERMINAL_TASK_STATUSES,
    operatorId: undefined,
    date: undefined,
    plannedDate: undefined,
    awaiting: undefined,
    mode: undefined,
  }
  const isNew = firstParam(raw.new) === "1"
  // 多对多入口预填:支持 ?sampleIds=id1,id2,id3(新建 task 覆盖 N 个样本);?sampleBatchId= 自动全选该批次
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
  // tab 默认值不写(由 ListTabs 默认逻辑处理),只在非默认时写
  if (firstParam(raw.tab) && firstParam(raw.tab) !== "doing") baseParams.set("tab", firstParam(raw.tab)!)
  for (const key of ["projectId", "date", "plannedDate", "awaiting"]) {
    const value = firstParam(raw[key])
    if (value) baseParams.set(key, value)
  }
  if (!isScheduleMode) {
    if (query.q) baseParams.set("q", query.q)
    if (query.status?.length) baseParams.set("status", query.status.join(","))
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
  // 「排期」是独立工具(ADR-0003)，显式 href 带 mode=schedule + 当前 plannedDate(日历选中日跟着走)。
  const scheduleModeHref = () => {
    const params = new URLSearchParams(baseParams)
    params.set("mode", "schedule")
    if (query.plannedDate) params.set("plannedDate", query.plannedDate)
    return `/lab?${params.toString()}`
  }
  // 状态 Tab(待办/进行中/已完成)切换时清掉 plannedDate ——
  // 它是排期模式带出的隐藏筛选，状态 Tab 视图里没有任何可见 chip 提示这个筛选存在，
  // 留着会让用户看到一个"莫名被日期过滤"的列表却找不到原因。
  // pageHref / viewHref 不受影响，翻页/开面板不应该改变当前筛选状态。
  const tabSwitchParams = new URLSearchParams(baseParams)
  tabSwitchParams.delete("plannedDate")
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
  const hasActiveFilters = Boolean(query.q || query.status?.length || query.date || query.plannedDate)
  const clearParams = new URLSearchParams()
  if (firstParam(raw.tab) && firstParam(raw.tab) !== "doing") clearParams.set("tab", firstParam(raw.tab)!)
  if (query.projectId) clearParams.set("projectId", query.projectId)
  const clearFiltersHref = clearParams.size ? `/lab?${clearParams.toString()}` : "/lab"
  const selectedScheduleDate = query.plannedDate ?? (query.date === "today" ? todayString() : undefined)

  const activeModeTab = isScheduleMode ? "schedule" : tab

  return (
    <div className="group/list flex flex-1 flex-col gap-4 p-4 md:p-6">
      <h1 className="sr-only">实验</h1>

      {/*
        状态 Tab（待办/进行中/已完成）与「排期」是一行统一的 Tabs：
        前三项共享 ?tab= 是同一批数据按状态分组；「排期」项带图标 + 显式 href（?mode=schedule），
        跳到日历规划 + 按批次预约新任务的独立工具（不是同一份数据的另一种视图，见 ADR-0003）。
        不再有"我的/团队"scope 控件——内部全员可见的小团队工具，个人/团队视角切换的
        实际价值低于界面复杂度，负责人信息已在表格列可见，见 ADR-0003 移除记录。
      */}
      <ListTabs
        basePath="/lab"
        value={activeModeTab}
        defaultValue="doing"
        items={[
          { value: "todo", label: "待办" },
          { value: "doing", label: "进行中" },
          { value: "done", label: "已完成" },
          {
            value: "schedule",
            label: (
              <>
                <CalendarClock data-icon="inline-start" aria-hidden="true" className="size-3.5" />
                排期
              </>
            ),
            href: scheduleModeHref(),
          },
        ]}
        extraSearchParams={tabSwitchParams}
      />

      {!isScheduleMode && (
        <ListToolbar
          basePath="/lab"
          searchPlaceholder="搜索任务编号 / 实验类型 / 上机方式 / 样本 / 项目…"
          searchDefault={query.q}
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
            title={query.projectId ? "该项目暂无实验任务" : TAB_EMPTY[tab].title}
            description={
              query.projectId
                ? "样本接收后，点上方「排期」标签按批次预约实验。"
                : TAB_EMPTY[tab].description
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
