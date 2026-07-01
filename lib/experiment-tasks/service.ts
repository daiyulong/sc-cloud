import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  buildExperimentTaskScope,
  buildProjectScope,
  tasksAwaitingBioinfoWhere,
} from "@/lib/auth/role-scope"
import { staffRoles } from "@/lib/auth/action-roles"
import { recordOperation } from "@/lib/operation-log"
import { advanceProjectStatus } from "@/lib/projects/aggregation"
import { compareDateOnly, toDateOnly } from "@/lib/utils"
import {
  BIOINFO_SERVICE_LEVELS,
  ExperimentTaskStatus,
  OperationAction,
  ProjectStatus,
  SampleBatchStatus,
  SampleStatus,
  SERVICE_LEVEL_LABELS,
  UserRole,
  type ProjectStatus as ProjectStatusValue,
  type SampleStatus as SampleStatusValue,
  type ServiceLevel as ServiceLevelValue,
  type UserRole as UserRoleValue,
} from "@/lib/enums"
import type {
  CreateExperimentTaskInput,
  CreateExperimentTaskWithSamplesInput,
  ExperimentTaskListQuery,
  FinishTaskInput,
  RecordQcInput,
  RecordRunMetricsInput,
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
  metricsRecordableTaskStatuses,
  qcRecordableTaskStatuses,
  taskCreatableProjectStatuses,
  taskCreatableSampleStatuses,
} from "@/lib/experiment-tasks/rules"
import { notifyBioinfoTaskAssigned, type BioinfoTaskForNotify } from "@/lib/notify/task-reminder"

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
  customerOrg: true,
  customerName: true,
  status: true,
  serviceLevel: true,
  salesOwnerId: true,
} satisfies Prisma.ProjectSelect

// 一次上机关联的样本叶子（经 TaskSample）。产出指标在叶子上；接收时间经批次。
const taskLeafSelect = {
  id: true,
  sampleName: true,
  species: true,
  tissueType: true,
  status: true,
  suspensionType: true,
  sequencingAmount: true,
  capturedCells: true,
  medianGenes: true,
  batch: { select: { batchNo: true, receivedAt: true } },
} satisfies Prisma.SampleSelect

const taskInclude = {
  project: { select: taskProjectSelect },
  taskSamples: { include: { sample: { select: taskLeafSelect } } },
  operator: { select: taskUserSelect },
} satisfies Prisma.ExperimentTaskInclude

const bioinfoNotifyInclude = {
  project: { select: { projectNo: true, customerOrg: true } },
  analyst: { select: { name: true, email: true } },
} satisfies Prisma.BioinfoTaskInclude

type TaskWithSamples = Prisma.ExperimentTaskGetPayload<{ include: typeof taskInclude }>
type TaskLeaf = Prisma.SampleGetPayload<{ select: typeof taskLeafSelect }>
type BioinfoNotifyTask = Prisma.BioinfoTaskGetPayload<{ include: typeof bioinfoNotifyInclude }>

function taskLeaves(task: { taskSamples: { sample: TaskLeaf }[] }): TaskLeaf[] {
  return task.taskSamples.map((ts) => ts.sample)
}

/** 该任务关联样本的最晚接收日（实验日期须 ≥ 各样本接收日）。 */
function latestReceivedAt(task: { taskSamples: { sample: TaskLeaf }[] }): Date | null {
  const times = taskLeaves(task)
    .map((s) => s.batch.receivedAt)
    .filter((d): d is Date => d != null)
    .map((d) => d.getTime())
  return times.length ? new Date(Math.max(...times)) : null
}

function dateOnlyRange(value: Date | string) {
  const start = toDateOnly(value)
  if (!start) return null
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

// new Date() 恒为合法日期，dateOnlyRange 必非 null。
function todayRange() {
  return dateOnlyRange(new Date())!
}

function buildTaskListWhere(
  operator: ExperimentTaskOperator,
  query: ExperimentTaskListQuery
): Prisma.ExperimentTaskWhereInput {
  const filters: Prisma.ExperimentTaskWhereInput[] = [
    buildExperimentTaskScope(operator.role),
  ]

  if (query.q) {
    filters.push({
      OR: [
        { taskNo: { contains: query.q, mode: "insensitive" } },
        { experimentType: { contains: query.q, mode: "insensitive" } },
        { runMethod: { contains: query.q, mode: "insensitive" } },
        { taskSamples: { some: { sample: { sampleName: { contains: query.q, mode: "insensitive" } } } } },
        { project: { projectNo: { contains: query.q, mode: "insensitive" } } },
      ],
    })
  }
  if (query.status?.length) filters.push({ status: { in: query.status } })
  if (query.projectId) filters.push({ projectId: query.projectId })
  if (query.operatorId) filters.push({ operatorId: query.operatorId })
  if (query.date === "today") {
    const { start, end } = todayRange()
    filters.push({ plannedDate: { gte: start, lt: end } })
  }
  if (query.plannedDate) {
    const range = dateOnlyRange(query.plannedDate)
    if (range) filters.push({ plannedDate: { gte: range.start, lt: range.end } })
  }
  if (query.awaiting === "bioinfo") filters.push(tasksAwaitingBioinfoWhere)

  return { AND: filters }
}

// 开放协作：写操作前置读不带 scope（可见性全员开放），权限由各动作的 ensureExperimentTaskRole 承担。
async function getWritableTask(id: string) {
  const task = await prisma.experimentTask.findUnique({
    where: { id },
    include: taskInclude,
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
      where: { AND: [{ id }, buildExperimentTaskScope(operator.role)] },
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
    where: { AND: [{ id: taskId }, buildExperimentTaskScope(operator.role)] },
    select: { id: true },
  })
  if (!task) throw new ExperimentTaskDomainError("实验任务不存在或无权访问", 404)

  return prisma.qcRecord.findMany({
    where: { taskId },
    include: { createdByUser: { select: taskUserSelect } },
    orderBy: { createdAt: "desc" },
  })
}

/**
 * 多对多入口：从 N 个样本叶子创建一次实验任务（§5.1：已到样 → 任务待排期）。
 * 一次上机多样本是 M3 落地现实（TaskSample 多对多表已建），本函数是 schema/service 的多对多实现。
 *
 * 同事务内校验 + 写入：所有 sample 同 project、status ∈ taskCreatableSampleStatuses、
 * taskSamples.none（未上机）；一次性 SELECT + 内存判后 createMany TaskSample。
 *
 * 失败语义：
 *  - 部分 ID 找不到 / 已上机 → 404（语义：调用方传入了无效或重复利用的样本）
 *  - 跨项目 → 400
 *  - sample / project 状态不符 → 409
 */
export async function createExperimentTaskFromSamples(
  operator: ExperimentTaskOperator,
  input: CreateExperimentTaskWithSamplesInput
) {
  ensureExperimentTaskRole(operator.role, undefined, "创建实验任务")

  // 去重（防御性：调用方可能误传重复 ID）
  const uniqueIds = Array.from(new Set(input.sampleIds))

  const samples = await prisma.sample.findMany({
    where: {
      AND: [
        { id: { in: uniqueIds } },
        { project: buildProjectScope(operator.role) },
        { status: { in: [...taskCreatableSampleStatuses] } },
        // 未上机：TaskSample 无任何关联
        { taskSamples: { none: {} } },
      ],
    },
    include: { project: { select: taskProjectSelect } },
  })

  if (samples.length !== uniqueIds.length) {
    throw new ExperimentTaskDomainError(
      "部分样本不存在、已上机或无权访问，请刷新后重试",
      404
    )
  }

  const projectIds = new Set(samples.map((s) => s.projectId))
  if (projectIds.size !== 1) {
    throw new ExperimentTaskDomainError("所有样本必须属于同一项目", 400)
  }

  const project = samples[0].project
  ensureProjectCanCreateTask(project.status as ProjectStatusValue)
  for (const s of samples) {
    ensureSampleCanCreateTask(s.status as SampleStatusValue)
  }

  return prisma.$transaction(async (tx) => {
    const taskCount = await tx.experimentTask.count({ where: { projectId: project.id } })
    const taskNo = `${project.projectNo ?? project.id}-E${String(taskCount + 1).padStart(2, "0")}`

    const task = await tx.experimentTask.create({
      data: {
        taskNo,
        projectId: project.id,
        experimentType: input.experimentType,
        runMethod: input.runMethod ?? null,
        department: input.department ?? null,
        plannedDate: input.plannedDate ?? null,
        operatorId: input.operatorId ?? null,
        status: input.plannedDate
          ? ExperimentTaskStatus.scheduled
          : ExperimentTaskStatus.waiting_schedule,
        taskSamples: {
          createMany: { data: uniqueIds.map((sampleId) => ({ sampleId })) },
        },
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

/**
 * 单样本向后兼容快捷：内部委托到多对多入口 sampleIds=[id]。
 * 路由 /api/samples/[id]/experiment-tasks 仍可用，便于历史链接与外部脚本。
 */
export async function createExperimentTaskFromSample(
  operator: ExperimentTaskOperator,
  sampleId: string,
  input: CreateExperimentTaskInput
) {
  return createExperimentTaskFromSamples(operator, { ...input, sampleIds: [sampleId] })
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
 * 关联样本叶子 received → lab_in_progress（扇出）；项目下首个任务 start 时 sample_received → lab_in_progress（§7.1）。
 */
export async function startExperimentTask(
  operator: ExperimentTaskOperator,
  id: string,
  input: StartTaskInput
) {
  ensureExperimentTaskRole(operator.role, undefined, "开始实验")
  const before = await getWritableTask(id)
  ensureExperimentTaskStatus(before.status, [ExperimentTaskStatus.scheduled], "开始实验")
  ensureActualDateValid(input.actualDate, latestReceivedAt(before), operator.role)

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

    await advanceSamplesToLab(tx, operator, taskLeaves(before), updated.taskNo)
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

/** 完成实验（进行中 → 待提交结果）：等待提交结果（不触发项目聚合） */
export async function finishExperimentTask(
  operator: ExperimentTaskOperator,
  id: string,
  input: FinishTaskInput
) {
  ensureExperimentTaskRole(operator.role, undefined, "完成实验")
  const before = await getWritableTask(id)
  ensureExperimentTaskStatus(before.status, [ExperimentTaskStatus.in_progress], "完成实验")
  ensureActualDateValid(input.actualDate, latestReceivedAt(before), operator.role)

  return prisma.$transaction(async (tx) => {
    const updated = await tx.experimentTask.update({
      where: { id },
      data: {
        status: ExperimentTaskStatus.waiting_feedback,
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
    return updated
  })
}

/**
 * 提交实验结果（§5.1：进行中/待提交结果 → 已完成）。同一事务内聚合驱动：
 * 关联样本叶子 → feedback_submitted（扇出）；项目下实验任务全部完成时按 service_level 分流（§7.1）。
 */
export async function submitExperimentFeedback(
  operator: ExperimentTaskOperator,
  id: string,
  input: SubmitFeedbackInput
) {
  ensureExperimentTaskRole(operator.role, undefined, "提交实验结果")
  const before = await getWritableTask(id)
  ensureExperimentTaskStatus(before.status, feedbackSubmittableTaskStatuses, "提交实验结果")
  ensureActualDateValid(input.actualDate, latestReceivedAt(before), operator.role)

  const bioinfoAnalystId = input.bioinfoAnalystId ?? null
  if (
    bioinfoAnalystId &&
    BIOINFO_SERVICE_LEVELS.includes(before.project.serviceLevel as ServiceLevelValue)
  ) {
    const analyst = await prisma.user.findFirst({
      where: { id: bioinfoAnalystId, role: UserRole.bioinfo_analyst, isActive: true },
      select: { id: true },
    })
    if (!analyst) {
      throw new ExperimentTaskDomainError("生信分析员不存在或不可用", 404)
    }
  }

  const { updated, createdBioinfoTasks } = await prisma.$transaction(async (tx) => {
    const updated = await tx.experimentTask.update({
      where: { id },
      data: {
        status: ExperimentTaskStatus.completed,
        resultStatus: input.resultStatus,
        resultFeedback: input.resultFeedback,
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

    // 样本结果完成（扇出所有关联叶子）
    for (const leaf of taskLeaves(before)) {
      if (leaf.status === SampleStatus.feedback_submitted) continue
      const sampleAfter = await tx.sample.update({
        where: { id: leaf.id },
        data: { status: SampleStatus.feedback_submitted },
      })
      await recordOperation({
        tx,
        entityType: "sample",
        entityId: leaf.id,
        action: OperationAction.status_change,
        operatorId: operator.id,
        before: leaf,
        after: { sample: sampleAfter, trigger: `experiment_task:${updated.taskNo}:feedback` },
      })
    }

    // 项目聚合：实验任务全部完成 → 按服务档次分流
    const createdBioinfoTasks: BioinfoNotifyTask[] = []
    if (before.project.status === ProjectStatus.lab_in_progress) {
      const remaining = await tx.experimentTask.count({
        where: {
          projectId: before.projectId,
          status: { notIn: [ExperimentTaskStatus.completed, ExperimentTaskStatus.cancelled] },
        },
      })
      if (remaining === 0) {
        const hasBioinfoService = BIOINFO_SERVICE_LEVELS.includes(
          before.project.serviceLevel as ServiceLevelValue
        )
        const next = hasBioinfoService
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

        if (hasBioinfoService) {
          const completedWithoutBioinfo = await tx.experimentTask.findMany({
            where: {
              projectId: before.projectId,
              status: ExperimentTaskStatus.completed,
              bioinfoTasks: { none: {} },
            },
            select: { id: true },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          })
          let bioinfoTaskCount = await tx.bioinfoTask.count({
            where: { projectId: before.projectId },
          })

          for (const expTask of completedWithoutBioinfo) {
            bioinfoTaskCount += 1
            const taskNo = `${before.project.projectNo ?? before.project.id}-B${String(
              bioinfoTaskCount
            ).padStart(2, "0")}`
            const created = await tx.bioinfoTask.create({
              data: {
                taskNo,
                projectId: before.projectId,
                experimentTaskId: expTask.id,
                analysisType:
                  SERVICE_LEVEL_LABELS[before.project.serviceLevel as ServiceLevelValue] ?? null,
                analystId: bioinfoAnalystId,
              },
              include: bioinfoNotifyInclude,
            })

            await recordOperation({
              tx,
              entityType: "bioinfo_task",
              entityId: created.id,
              action: OperationAction.create,
              operatorId: operator.id,
              after: {
                ...created,
                trigger: `experiment_task:${updated.taskNo}:feedback`,
              },
            })
            createdBioinfoTasks.push(created)
          }
        }
      }
    }

    return { updated, createdBioinfoTasks }
  })

  for (const task of createdBioinfoTasks) {
    if (task.analystId) {
      await notifyBioinfoTaskAssigned(task as BioinfoTaskForNotify, "created", operator.id)
    }
  }

  return updated
}

/**
 * 录入质控（§5.1 / §6.6）：为该任务关联的样本叶子各建一条 qc_record（M1 单样本任务=一条）。
 * 不改任务执行态（业务判定与执行态正交）。
 */
export async function recordTaskQc(
  operator: ExperimentTaskOperator,
  id: string,
  input: RecordQcInput
) {
  ensureExperimentTaskRole(operator.role, undefined, "录入质控")
  const before = await getWritableTask(id)
  ensureExperimentTaskStatus(before.status, qcRecordableTaskStatuses, "录入质控")
  const leaves = taskLeaves(before)
  if (leaves.length === 0) {
    throw new ExperimentTaskDomainError("该任务尚未关联样本，无法录入质控", 409)
  }

  return prisma.$transaction(async (tx) => {
    const created = []
    for (const leaf of leaves) {
      const qc = await tx.qcRecord.create({
        data: {
          sampleId: leaf.id,
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
      created.push(qc)
    }

    await recordOperation({
      tx,
      entityType: "experiment_task",
      entityId: id,
      action: OperationAction.create,
      operatorId: operator.id,
      after: { qcRecords: created, kind: "qc_record" },
    })

    return created[0]
  })
}

/**
 * 录入产出指标（§6.8 经验视图）：实验完成后补录到样本叶子（悬液类型/测序量/捕获数/基因中位数）。
 * 不改任务执行态、可重复订正；权限含生信分析员（下机数据到手者）。M1 单样本任务写其唯一叶子。
 */
export async function recordRunMetrics(
  operator: ExperimentTaskOperator,
  id: string,
  input: RecordRunMetricsInput
) {
  ensureExperimentTaskRole(operator.role, staffRoles, "录入产出指标")
  const before = await getWritableTask(id)
  ensureExperimentTaskStatus(before.status, metricsRecordableTaskStatuses, "录入产出指标")
  const leaves = taskLeaves(before)
  if (leaves.length === 0) {
    throw new ExperimentTaskDomainError("该任务尚未关联样本，无法录入产出指标", 409)
  }

  const data = Object.fromEntries(
    Object.entries({
      suspensionType: input.suspensionType,
      sequencingAmount: input.sequencingAmount,
      capturedCells: input.capturedCells,
      medianGenes: input.medianGenes,
    }).filter(([, value]) => value !== undefined)
  ) as Prisma.SampleUpdateInput

  return prisma.$transaction(async (tx) => {
    for (const leaf of leaves) {
      await tx.sample.update({ where: { id: leaf.id }, data })
    }
    const updated = await tx.experimentTask.findUniqueOrThrow({ where: { id }, include: taskInclude })
    await recordOperation({
      tx,
      entityType: "experiment_task",
      entityId: id,
      action: OperationAction.update,
      operatorId: operator.id,
      before,
      after: { task: updated, kind: "run_metrics" },
    })
    return updated
  })
}

/** 聚合：样本叶子进入实验中（扇出，仅当尚未进入实验/出结果态时） */
async function advanceSamplesToLab(
  tx: Prisma.TransactionClient,
  operator: ExperimentTaskOperator,
  leaves: { id: string; status: SampleStatusValue }[],
  triggerTaskNo: string
) {
  for (const leaf of leaves) {
    if (
      leaf.status !== SampleStatus.received &&
      leaf.status !== SampleStatus.received_abnormal &&
      leaf.status !== SampleStatus.waiting_task
    ) {
      continue
    }
    const sampleAfter = await tx.sample.update({
      where: { id: leaf.id },
      data: { status: SampleStatus.lab_in_progress },
    })
    await recordOperation({
      tx,
      entityType: "sample",
      entityId: leaf.id,
      action: OperationAction.status_change,
      operatorId: operator.id,
      before: leaf,
      after: { sample: sampleAfter, trigger: `experiment_task:${triggerTaskNo}:start` },
    })
  }
}

export function handleExperimentTaskDomainError(error: unknown) {
  if (error instanceof ExperimentTaskDomainError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  return null
}

export type { TaskWithSamples }

/* ----------------------------------------------------------------------------
 * 待预约批次查询（实验工位的 "14 天预约候选池"）
 * 收样批次符合"已接收/异常接收 + 项目允许建任务 + 仍有未上机样本"即为待预约批次。
 * 仅承担查询与可见性，不动状态机。原先独立在 appointments.ts，已合并到 service 层。
 * --------------------------------------------------------------------------*/

const appointmentSampleWhere: Prisma.SampleWhereInput = {
  status: { in: [...taskCreatableSampleStatuses] },
  taskSamples: { none: {} },
}

export function buildExperimentAppointmentBatchWhere(
  role: UserRoleValue | undefined,
  filters: { projectId?: string | null } = {}
): Prisma.SampleBatchWhereInput {
  const clauses: Prisma.SampleBatchWhereInput[] = [
    { project: buildProjectScope(role) },
    { status: { in: [SampleBatchStatus.received, SampleBatchStatus.received_abnormal] } },
    { project: { status: { in: [...taskCreatableProjectStatuses] } } },
    { samples: { some: appointmentSampleWhere } },
  ]
  if (filters.projectId) clauses.push({ projectId: filters.projectId })
  return { AND: clauses }
}

export async function listExperimentAppointmentBatches(
  role: UserRoleValue | undefined,
  filters: { projectId?: string | null; take?: number } = {}
) {
  const batches = await prisma.sampleBatch.findMany({
    where: buildExperimentAppointmentBatchWhere(role, filters),
    select: {
      id: true,
      batchNo: true,
      experimentType: true,
      receivedAt: true,
      sampleCount: true,
      project: { select: { id: true, projectNo: true, customerOrg: true } },
      _count: {
        select: {
          samples: { where: appointmentSampleWhere },
        },
      },
    },
    orderBy: [{ receivedAt: "desc" }, { updatedAt: "desc" }],
    take: filters.take ?? 10,
  })

  return batches.map(({ _count, ...batch }) => ({
    ...batch,
    appointmentSampleCount: _count.samples,
  }))
}

export function countExperimentAppointmentBatches(
  role: UserRoleValue | undefined,
  filters: { projectId?: string | null } = {}
) {
  return prisma.sampleBatch.count({
    where: buildExperimentAppointmentBatchWhere(role, filters),
  })
}
