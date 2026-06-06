import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildExperimentTaskScope, buildProjectScope } from "@/lib/auth/role-scope"
import { recordOperation } from "@/lib/operation-log"
import { compareDateOnly } from "@/lib/utils"
import {
  BIOINFO_SERVICE_LEVELS,
  ExperimentTaskStatus,
  OperationAction,
  ProjectStatus,
  SampleStatus,
  UserRole,
  type ServiceLevel as ServiceLevelValue,
  type UserRole as UserRoleValue,
} from "@/lib/enums"
import type {
  CreateExperimentTaskInput,
  ExperimentTaskListQuery,
  FinishTaskInput,
  RecordQcInput,
  ScheduleTaskInput,
  StartTaskInput,
  SubmitFeedbackInput,
  UpdateExperimentTaskInput,
} from "@/lib/schemas/experiment-task"
import {
  ExperimentTaskDomainError,
  ensureExperimentTaskRole,
  ensureExperimentTaskStatus,
  ensureProjectCanCreateTask,
  ensureSampleCanCreateTask,
  feedbackSubmittableTaskStatuses,
  qcRecordableTaskStatuses,
} from "@/lib/experiment-tasks/rules"

export type ExperimentTaskOperator = {
  id: string
  role?: UserRoleValue
}

const taskUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  department: true,
  phone: true,
} satisfies Prisma.UserSelect

const taskProjectSelect = {
  id: true,
  projectNo: true,
  orderNo: true,
  customerOrg: true,
  customerName: true,
  status: true,
  serviceLevel: true,
  salesOwnerId: true,
} satisfies Prisma.ProjectSelect

const taskSampleSelect = {
  id: true,
  sampleNo: true,
  species: true,
  tissueType: true,
  status: true,
  receivedAt: true,
} satisfies Prisma.SampleSelect

const taskInclude = {
  project: { select: taskProjectSelect },
  sample: { select: taskSampleSelect },
  operator: { select: taskUserSelect },
} satisfies Prisma.ExperimentTaskInclude

function todayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

function buildTaskListWhere(
  operator: ExperimentTaskOperator,
  query: ExperimentTaskListQuery
): Prisma.ExperimentTaskWhereInput {
  const filters: Prisma.ExperimentTaskWhereInput[] = [
    buildExperimentTaskScope(operator.role, operator.id),
  ]

  if (query.q) {
    filters.push({
      OR: [
        { taskNo: { contains: query.q, mode: "insensitive" } },
        { experimentType: { contains: query.q, mode: "insensitive" } },
        { runMethod: { contains: query.q, mode: "insensitive" } },
        { sample: { sampleNo: { contains: query.q, mode: "insensitive" } } },
        { project: { projectNo: { contains: query.q, mode: "insensitive" } } },
      ],
    })
  }
  if (query.status) filters.push({ status: query.status })
  if (query.projectId) filters.push({ projectId: query.projectId })
  if (query.operatorId) filters.push({ operatorId: query.operatorId })
  if (query.date === "today") {
    const { start, end } = todayRange()
    filters.push({ plannedDate: { gte: start, lt: end } })
  }

  return { AND: filters }
}

async function getWritableTask(id: string) {
  const task = await prisma.experimentTask.findUnique({
    where: { id },
    include: { project: { select: taskProjectSelect }, sample: { select: taskSampleSelect } },
  })
  if (!task) throw new ExperimentTaskDomainError("实验任务不存在", 404)
  return task
}

/**
 * 实际实验日期不能早于样本接收日期（自然日比较，同日通过；§8.7）。
 * 仅在显式传入 actualDate 且真正早于接收日时拦截；管理员可越过（异常补录）。
 */
function ensureActualDateValid(
  actualDate: Date | null | undefined,
  receivedAt: Date | null,
  role?: UserRoleValue
) {
  if (!actualDate || !receivedAt || role === UserRole.admin) return
  if (compareDateOnly(actualDate, receivedAt) === -1) {
    throw new ExperimentTaskDomainError(
      "实际实验日期不能早于样本接收日期（如确需补录请由管理员操作）",
      409
    )
  }
}

export async function listExperimentTasks(
  operator: ExperimentTaskOperator,
  query: ExperimentTaskListQuery,
  pagination: { skip: number; limit: number }
) {
  const where = buildTaskListWhere(operator, query)
  const [data, total] = await Promise.all([
    prisma.experimentTask.findMany({
      where,
      include: taskInclude,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.experimentTask.count({ where }),
  ])
  return { data, total }
}

export async function getExperimentTaskDetail(operator: ExperimentTaskOperator, id: string) {
  const [task, operationLogs] = await Promise.all([
    prisma.experimentTask.findFirst({
      where: { AND: [{ id }, buildExperimentTaskScope(operator.role, operator.id)] },
      include: {
        ...taskInclude,
        qcRecords: {
          include: { createdByUser: { select: taskUserSelect } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.operationLog.findMany({
      where: { entityType: "experiment_task", entityId: id },
      include: { operator: { select: taskUserSelect } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ])

  if (!task) throw new ExperimentTaskDomainError("实验任务不存在或无权访问", 404)
  return { task, operationLogs }
}

/** 该任务下的质控记录（带可见范围校验） */
export async function listTaskQcRecords(operator: ExperimentTaskOperator, taskId: string) {
  const task = await prisma.experimentTask.findFirst({
    where: { AND: [{ id: taskId }, buildExperimentTaskScope(operator.role, operator.id)] },
    select: { id: true },
  })
  if (!task) throw new ExperimentTaskDomainError("实验任务不存在或无权访问", 404)

  return prisma.qcRecord.findMany({
    where: { taskId },
    include: { createdByUser: { select: taskUserSelect } },
    orderBy: { createdAt: "desc" },
  })
}

/** 从样本创建实验任务（§5.1：已到样 → 任务待排期），任务编号系统生成 */
export async function createExperimentTaskFromSample(
  operator: ExperimentTaskOperator,
  sampleId: string,
  input: CreateExperimentTaskInput
) {
  ensureExperimentTaskRole(operator.role, undefined, "创建实验任务")

  const sample = await prisma.sample.findFirst({
    where: { AND: [{ id: sampleId }, { project: buildProjectScope(operator.role, operator.id) }] },
    include: { project: { select: taskProjectSelect } },
  })
  if (!sample) throw new ExperimentTaskDomainError("样本不存在或无权访问", 404)
  ensureProjectCanCreateTask(sample.project.status)
  ensureSampleCanCreateTask(sample.status)

  return prisma.$transaction(async (tx) => {
    const taskCount = await tx.experimentTask.count({ where: { projectId: sample.projectId } })
    const taskNo = `${sample.project.orderNo}-E${String(taskCount + 1).padStart(2, "0")}`

    const task = await tx.experimentTask.create({
      data: {
        taskNo,
        projectId: sample.projectId,
        sampleId: sample.id,
        experimentType: input.experimentType,
        runMethod: input.runMethod ?? null,
        department: input.department ?? null,
        plannedDate: input.plannedDate ?? null,
        operatorId: input.operatorId ?? null,
        status: input.plannedDate
          ? ExperimentTaskStatus.scheduled
          : ExperimentTaskStatus.waiting_schedule,
      },
      include: taskInclude,
    })

    await recordOperation({
      tx,
      entityType: "experiment_task",
      entityId: task.id,
      action: OperationAction.create,
      operatorId: operator.id,
      after: task,
    })

    return task
  })
}

export async function updateExperimentTask(
  operator: ExperimentTaskOperator,
  id: string,
  input: UpdateExperimentTaskInput
) {
  ensureExperimentTaskRole(operator.role, undefined, "更新实验任务")
  const before = await getWritableTask(id)

  const data = Object.fromEntries(
    Object.entries({
      experimentType: input.experimentType,
      runMethod: input.runMethod,
      department: input.department,
      plannedDate: input.plannedDate,
      loadedSampleCount: input.loadedSampleCount,
    }).filter(([, value]) => value !== undefined)
  ) as Prisma.ExperimentTaskUpdateInput

  if (input.operatorId !== undefined) {
    data.operator = input.operatorId
      ? { connect: { id: input.operatorId } }
      : { disconnect: true }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.experimentTask.update({ where: { id }, data, include: taskInclude })
    await recordOperation({
      tx,
      entityType: "experiment_task",
      entityId: id,
      action: OperationAction.update,
      operatorId: operator.id,
      before,
      after: updated,
    })
    return updated
  })
}

/** 设置排期（§5.1：待排期 → 已排期），可同时指派负责人/上机方式/部门 */
export async function scheduleExperimentTask(
  operator: ExperimentTaskOperator,
  id: string,
  input: ScheduleTaskInput
) {
  ensureExperimentTaskRole(operator.role, undefined, "设置排期")
  const before = await getWritableTask(id)
  ensureExperimentTaskStatus(
    before.status,
    [ExperimentTaskStatus.waiting_schedule, ExperimentTaskStatus.scheduled],
    "设置排期"
  )

  const data: Prisma.ExperimentTaskUpdateInput = {
    status: ExperimentTaskStatus.scheduled,
    plannedDate: input.plannedDate,
    runMethod: input.runMethod ?? before.runMethod,
    department: input.department ?? before.department,
  }
  if (input.operatorId !== undefined) {
    data.operator = input.operatorId
      ? { connect: { id: input.operatorId } }
      : { disconnect: true }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.experimentTask.update({ where: { id }, data, include: taskInclude })
    await recordOperation({
      tx,
      entityType: "experiment_task",
      entityId: id,
      action: OperationAction.status_change,
      operatorId: operator.id,
      before,
      after: updated,
    })
    return updated
  })
}

/**
 * 开始实验（§5.1：已排期 → 进行中）。同一事务内聚合驱动：
 * 样本 received → lab_in_progress；项目下首个任务 start 时 sample_received → lab_in_progress（§7.1）。
 */
export async function startExperimentTask(
  operator: ExperimentTaskOperator,
  id: string,
  input: StartTaskInput
) {
  ensureExperimentTaskRole(operator.role, undefined, "开始实验")
  const before = await getWritableTask(id)
  ensureExperimentTaskStatus(before.status, [ExperimentTaskStatus.scheduled], "开始实验")
  ensureActualDateValid(input.actualDate, before.sample.receivedAt, operator.role)

  return prisma.$transaction(async (tx) => {
    const updated = await tx.experimentTask.update({
      where: { id },
      data: {
        status: ExperimentTaskStatus.in_progress,
        actualDate: input.actualDate ?? before.actualDate ?? new Date(),
      },
      include: taskInclude,
    })
    await recordOperation({
      tx,
      entityType: "experiment_task",
      entityId: id,
      action: OperationAction.status_change,
      operatorId: operator.id,
      before,
      after: updated,
    })

    await advanceSampleToLab(tx, operator, before.sample, before.sampleId, updated.taskNo)
    if (before.project.status === ProjectStatus.sample_received) {
      await advanceProjectStatus(
        tx,
        operator,
        before.project,
        before.projectId,
        ProjectStatus.lab_in_progress,
        `experiment_task:${updated.taskNo}:start`
      )
    }

    return updated
  })
}

/** 完成实验（进行中 → 待反馈）：录入上机信息，等待结果反馈（不触发项目聚合） */
export async function finishExperimentTask(
  operator: ExperimentTaskOperator,
  id: string,
  input: FinishTaskInput
) {
  ensureExperimentTaskRole(operator.role, undefined, "完成实验")
  const before = await getWritableTask(id)
  ensureExperimentTaskStatus(before.status, [ExperimentTaskStatus.in_progress], "完成实验")
  ensureActualDateValid(input.actualDate, before.sample.receivedAt, operator.role)

  return prisma.$transaction(async (tx) => {
    const updated = await tx.experimentTask.update({
      where: { id },
      data: {
        status: ExperimentTaskStatus.waiting_feedback,
        actualDate: input.actualDate ?? before.actualDate ?? new Date(),
        loadedSampleCount:
          input.loadedSampleCount === undefined
            ? before.loadedSampleCount
            : input.loadedSampleCount,
      },
      include: taskInclude,
    })
    await recordOperation({
      tx,
      entityType: "experiment_task",
      entityId: id,
      action: OperationAction.status_change,
      operatorId: operator.id,
      before,
      after: updated,
    })
    return updated
  })
}

/**
 * 提交实验反馈（§5.1：进行中/待反馈 → 已完成）。同一事务内聚合驱动：
 * 样本 → feedback_submitted；项目下实验任务全部完成时按 service_level 分流
 * lab_in_progress →（含生信）waiting_bioinfo /（不含生信）waiting_delivery（§7.1）。
 */
export async function submitExperimentFeedback(
  operator: ExperimentTaskOperator,
  id: string,
  input: SubmitFeedbackInput
) {
  ensureExperimentTaskRole(operator.role, undefined, "提交实验反馈")
  const before = await getWritableTask(id)
  ensureExperimentTaskStatus(before.status, feedbackSubmittableTaskStatuses, "提交实验反馈")
  ensureActualDateValid(input.actualDate, before.sample.receivedAt, operator.role)

  return prisma.$transaction(async (tx) => {
    const updated = await tx.experimentTask.update({
      where: { id },
      data: {
        status: ExperimentTaskStatus.completed,
        resultStatus: input.resultStatus,
        resultFeedback: input.resultFeedback,
        actualDate: input.actualDate ?? before.actualDate ?? new Date(),
        loadedSampleCount:
          input.loadedSampleCount === undefined
            ? before.loadedSampleCount
            : input.loadedSampleCount,
      },
      include: taskInclude,
    })
    await recordOperation({
      tx,
      entityType: "experiment_task",
      entityId: id,
      action: OperationAction.status_change,
      operatorId: operator.id,
      before,
      after: updated,
    })

    // 样本反馈完成
    if (before.sample.status !== SampleStatus.feedback_submitted) {
      const sampleAfter = await tx.sample.update({
        where: { id: before.sampleId },
        data: { status: SampleStatus.feedback_submitted },
      })
      await recordOperation({
        tx,
        entityType: "sample",
        entityId: before.sampleId,
        action: OperationAction.status_change,
        operatorId: operator.id,
        before: before.sample,
        after: { sample: sampleAfter, trigger: `experiment_task:${updated.taskNo}:feedback` },
      })
    }

    // 项目聚合：实验任务全部完成 → 按服务档次分流
    if (before.project.status === ProjectStatus.lab_in_progress) {
      const remaining = await tx.experimentTask.count({
        where: {
          projectId: before.projectId,
          status: { notIn: [ExperimentTaskStatus.completed, ExperimentTaskStatus.cancelled] },
        },
      })
      if (remaining === 0) {
        const next = BIOINFO_SERVICE_LEVELS.includes(before.project.serviceLevel as ServiceLevelValue)
          ? ProjectStatus.waiting_bioinfo
          : ProjectStatus.waiting_delivery
        await advanceProjectStatus(
          tx,
          operator,
          before.project,
          before.projectId,
          next,
          `experiment_task:${updated.taskNo}:feedback`
        )
      }
    }

    return updated
  })
}

/** 录入质控（§5.1 / §6.6）：进行中/待反馈允许，创建 qc_record，不改任务执行态（业务判定与执行态正交） */
export async function recordTaskQc(
  operator: ExperimentTaskOperator,
  id: string,
  input: RecordQcInput
) {
  ensureExperimentTaskRole(operator.role, undefined, "录入质控")
  const before = await getWritableTask(id)
  ensureExperimentTaskStatus(before.status, qcRecordableTaskStatuses, "录入质控")

  return prisma.$transaction(async (tx) => {
    const qc = await tx.qcRecord.create({
      data: {
        sampleId: before.sampleId,
        taskId: before.id,
        concentration: input.concentration ?? null,
        viability: input.viability ?? null,
        aggregationRate: input.aggregationRate ?? null,
        qcResult: input.qcResult,
        riskLevel: input.riskLevel,
        reason: input.reason ?? null,
        feedback: input.feedback ?? null,
        createdBy: operator.id,
      },
      include: { createdByUser: { select: taskUserSelect } },
    })

    await recordOperation({
      tx,
      entityType: "experiment_task",
      entityId: id,
      action: OperationAction.create,
      operatorId: operator.id,
      after: { qcRecord: qc, kind: "qc_record" },
    })

    return qc
  })
}

/** 聚合：样本进入实验中（仅当尚未进入实验/反馈态时） */
async function advanceSampleToLab(
  tx: Prisma.TransactionClient,
  operator: ExperimentTaskOperator,
  sampleBefore: { status: string },
  sampleId: string,
  triggerTaskNo: string
) {
  if (
    sampleBefore.status === SampleStatus.received ||
    sampleBefore.status === SampleStatus.received_abnormal ||
    sampleBefore.status === SampleStatus.waiting_task
  ) {
    const sampleAfter = await tx.sample.update({
      where: { id: sampleId },
      data: { status: SampleStatus.lab_in_progress },
    })
    await recordOperation({
      tx,
      entityType: "sample",
      entityId: sampleId,
      action: OperationAction.status_change,
      operatorId: operator.id,
      before: sampleBefore,
      after: { sample: sampleAfter, trigger: `experiment_task:${triggerTaskNo}:start` },
    })
  }
}

/** 聚合：推进项目状态并写日志（子实体动作驱动，§7.1） */
async function advanceProjectStatus(
  tx: Prisma.TransactionClient,
  operator: ExperimentTaskOperator,
  projectBefore: { status: string },
  projectId: string,
  next: (typeof ProjectStatus)[keyof typeof ProjectStatus],
  trigger: string
) {
  const projectAfter = await tx.project.update({
    where: { id: projectId },
    data: { status: next },
  })
  await recordOperation({
    tx,
    entityType: "project",
    entityId: projectId,
    action: OperationAction.status_change,
    operatorId: operator.id,
    before: projectBefore,
    after: { project: projectAfter, trigger },
  })
}

export function handleExperimentTaskDomainError(error: unknown) {
  if (error instanceof ExperimentTaskDomainError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  return null
}
