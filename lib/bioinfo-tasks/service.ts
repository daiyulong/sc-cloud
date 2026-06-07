import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildBioinfoTaskScope, buildProjectScope } from "@/lib/auth/role-scope"
import { recordOperation } from "@/lib/operation-log"
import {
  BioinfoTaskStatus,
  OperationAction,
  ProjectStatus,
  type ServiceLevel as ServiceLevelValue,
  type UserRole as UserRoleValue,
} from "@/lib/enums"
import type {
  BioinfoTaskListQuery,
  CreateBioinfoTaskInput,
  StartBioinfoTaskInput,
  SubmitBioinfoTaskInput,
  UpdateBioinfoTaskInput,
} from "@/lib/schemas/bioinfo-task"
import {
  BioinfoTaskDomainError,
  bioinfoCreateRoles,
  bioinfoManageRoles,
  ensureBioinfoRole,
  ensureBioinfoStatus,
  ensureExperimentTaskCompleted,
  ensureProjectCanCreateBioinfo,
  ensureServiceHasBioinfo,
  submittableBioinfoStatuses,
} from "@/lib/bioinfo-tasks/rules"

export type BioinfoTaskOperator = {
  id: string
  role?: UserRoleValue
}

const bioinfoUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  department: true,
  phone: true,
} satisfies Prisma.UserSelect

const bioinfoProjectSelect = {
  id: true,
  projectNo: true,
  orderNo: true,
  customerOrg: true,
  customerName: true,
  status: true,
  serviceLevel: true,
  salesOwnerId: true,
} satisfies Prisma.ProjectSelect

const bioinfoExperimentTaskSelect = {
  id: true,
  taskNo: true,
  experimentType: true,
  resultStatus: true,
} satisfies Prisma.ExperimentTaskSelect

const bioinfoInclude = {
  project: { select: bioinfoProjectSelect },
  experimentTask: { select: bioinfoExperimentTaskSelect },
  analyst: { select: bioinfoUserSelect },
} satisfies Prisma.BioinfoTaskInclude

const openBioinfoStatuses = [
  BioinfoTaskStatus.pending,
  BioinfoTaskStatus.in_progress,
  BioinfoTaskStatus.waiting_review,
]

function buildBioinfoListWhere(
  operator: BioinfoTaskOperator,
  query: BioinfoTaskListQuery
): Prisma.BioinfoTaskWhereInput {
  const filters: Prisma.BioinfoTaskWhereInput[] = [
    buildBioinfoTaskScope(operator.role, operator.id),
  ]

  if (query.q) {
    filters.push({
      OR: [
        { taskNo: { contains: query.q, mode: "insensitive" } },
        { analysisType: { contains: query.q, mode: "insensitive" } },
        { experimentTask: { taskNo: { contains: query.q, mode: "insensitive" } } },
        { project: { projectNo: { contains: query.q, mode: "insensitive" } } },
      ],
    })
  }
  if (query.status) filters.push({ status: query.status })
  if (query.projectId) filters.push({ projectId: query.projectId })
  if (query.analystId) filters.push({ analystId: query.analystId })
  if (query.open === "1") filters.push({ status: { in: openBioinfoStatuses } })

  return { AND: filters }
}

async function getWritableBioinfoTask(id: string) {
  const task = await prisma.bioinfoTask.findUnique({
    where: { id },
    include: { project: { select: bioinfoProjectSelect } },
  })
  if (!task) throw new BioinfoTaskDomainError("生信任务不存在", 404)
  return task
}

export async function listBioinfoTasks(
  operator: BioinfoTaskOperator,
  query: BioinfoTaskListQuery,
  pagination: { skip: number; limit: number }
) {
  const where = buildBioinfoListWhere(operator, query)
  const [data, total] = await Promise.all([
    prisma.bioinfoTask.findMany({
      where,
      include: bioinfoInclude,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.bioinfoTask.count({ where }),
  ])
  return { data, total }
}

export async function getBioinfoTaskDetail(operator: BioinfoTaskOperator, id: string) {
  const [task, operationLogs] = await Promise.all([
    prisma.bioinfoTask.findFirst({
      where: { AND: [{ id }, buildBioinfoTaskScope(operator.role, operator.id)] },
      include: bioinfoInclude,
    }),
    prisma.operationLog.findMany({
      where: { entityType: "bioinfo_task", entityId: id },
      include: { operator: { select: bioinfoUserSelect } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ])

  if (!task) throw new BioinfoTaskDomainError("生信任务不存在或无权访问", 404)
  return { task, operationLogs }
}

/** 从实验任务创建生信任务（§5.1：实验任务已完成且服务含生信 → 生信待开始） */
export async function createBioinfoTaskFromExperiment(
  operator: BioinfoTaskOperator,
  experimentTaskId: string,
  input: CreateBioinfoTaskInput
) {
  ensureBioinfoRole(operator.role, bioinfoCreateRoles, "创建生信任务")

  const expTask = await prisma.experimentTask.findFirst({
    where: {
      AND: [{ id: experimentTaskId }, { project: buildProjectScope(operator.role, operator.id) }],
    },
    include: { project: { select: bioinfoProjectSelect } },
  })
  if (!expTask) throw new BioinfoTaskDomainError("实验任务不存在或无权访问", 404)
  ensureServiceHasBioinfo(expTask.project.serviceLevel as ServiceLevelValue)
  ensureProjectCanCreateBioinfo(expTask.project.status)
  ensureExperimentTaskCompleted(expTask.status)

  return prisma.$transaction(async (tx) => {
    const count = await tx.bioinfoTask.count({ where: { projectId: expTask.projectId } })
    const taskNo = `${expTask.project.orderNo}-B${String(count + 1).padStart(2, "0")}`

    const task = await tx.bioinfoTask.create({
      data: {
        taskNo,
        projectId: expTask.projectId,
        experimentTaskId: expTask.id,
        analysisType: input.analysisType ?? null,
        analystId: input.analystId ?? null,
        dataReceivedAt: input.dataReceivedAt ?? null,
        remark: input.remark ?? null,
      },
      include: bioinfoInclude,
    })

    await recordOperation({
      tx,
      entityType: "bioinfo_task",
      entityId: task.id,
      action: OperationAction.create,
      operatorId: operator.id,
      after: task,
    })

    return task
  })
}

export async function updateBioinfoTask(
  operator: BioinfoTaskOperator,
  id: string,
  input: UpdateBioinfoTaskInput
) {
  ensureBioinfoRole(operator.role, bioinfoCreateRoles, "更新生信任务")
  const before = await getWritableBioinfoTask(id)

  const data = Object.fromEntries(
    Object.entries({
      analysisType: input.analysisType,
      dataReceivedAt: input.dataReceivedAt,
      deliverableNote: input.deliverableNote,
      remark: input.remark,
    }).filter(([, value]) => value !== undefined)
  ) as Prisma.BioinfoTaskUpdateInput

  if (input.analystId !== undefined) {
    data.analyst = input.analystId ? { connect: { id: input.analystId } } : { disconnect: true }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.bioinfoTask.update({ where: { id }, data, include: bioinfoInclude })
    await recordOperation({
      tx,
      entityType: "bioinfo_task",
      entityId: id,
      action: OperationAction.update,
      operatorId: operator.id,
      before,
      after: updated,
    })
    return updated
  })
}

/**
 * 开始分析（§5.1：待开始 → 分析中）。同一事务内聚合驱动：
 * 项目下首个生信任务 start 时 waiting_bioinfo → bioinfo_in_progress（§7.1）。
 */
export async function startBioinfoTask(
  operator: BioinfoTaskOperator,
  id: string,
  input: StartBioinfoTaskInput
) {
  ensureBioinfoRole(operator.role, bioinfoManageRoles, "开始分析")
  const before = await getWritableBioinfoTask(id)
  ensureBioinfoStatus(before.status, [BioinfoTaskStatus.pending], "开始分析")

  const data: Prisma.BioinfoTaskUpdateInput = {
    status: BioinfoTaskStatus.in_progress,
    dataReceivedAt: input.dataReceivedAt ?? before.dataReceivedAt ?? new Date(),
  }
  if (input.analystId !== undefined) {
    data.analyst = input.analystId ? { connect: { id: input.analystId } } : { disconnect: true }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.bioinfoTask.update({ where: { id }, data, include: bioinfoInclude })
    await recordOperation({
      tx,
      entityType: "bioinfo_task",
      entityId: id,
      action: OperationAction.status_change,
      operatorId: operator.id,
      before,
      after: updated,
    })

    if (before.project.status === ProjectStatus.waiting_bioinfo) {
      await advanceProjectStatus(
        tx,
        operator,
        before.project,
        before.projectId,
        ProjectStatus.bioinfo_in_progress,
        `bioinfo_task:${updated.taskNo}:start`
      )
    }

    return updated
  })
}

/** 提交审核（分析中 → 待审核）：分析完成、自检报告，可选中间步（不触发项目聚合） */
export async function reviewBioinfoTask(operator: BioinfoTaskOperator, id: string) {
  ensureBioinfoRole(operator.role, bioinfoManageRoles, "提交审核")
  const before = await getWritableBioinfoTask(id)
  ensureBioinfoStatus(before.status, [BioinfoTaskStatus.in_progress], "提交审核")

  return prisma.$transaction(async (tx) => {
    const updated = await tx.bioinfoTask.update({
      where: { id },
      data: { status: BioinfoTaskStatus.waiting_review },
      include: bioinfoInclude,
    })
    await recordOperation({
      tx,
      entityType: "bioinfo_task",
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
 * 提交报告（§5.1：分析中/待审核 → 生信待交付）。同一事务内聚合驱动：
 * 项目下生信任务全部进入待交付时 bioinfo_in_progress → waiting_delivery（§7.1）。
 * 报告交付日期（deliveredAt）在项目确认交付时统一落（§8.9），此处只记交付物说明。
 */
export async function submitBioinfoTask(
  operator: BioinfoTaskOperator,
  id: string,
  input: SubmitBioinfoTaskInput
) {
  ensureBioinfoRole(operator.role, bioinfoManageRoles, "提交报告")
  const before = await getWritableBioinfoTask(id)
  ensureBioinfoStatus(before.status, submittableBioinfoStatuses, "提交报告")

  return prisma.$transaction(async (tx) => {
    const updated = await tx.bioinfoTask.update({
      where: { id },
      data: {
        status: BioinfoTaskStatus.waiting_delivery,
        deliverableNote: input.deliverableNote ?? before.deliverableNote,
        analysisType: input.analysisType ?? before.analysisType,
      },
      include: bioinfoInclude,
    })
    await recordOperation({
      tx,
      entityType: "bioinfo_task",
      entityId: id,
      action: OperationAction.status_change,
      operatorId: operator.id,
      before,
      after: updated,
    })

    if (before.project.status === ProjectStatus.bioinfo_in_progress) {
      const remaining = await tx.bioinfoTask.count({
        where: {
          projectId: before.projectId,
          status: {
            notIn: [BioinfoTaskStatus.waiting_delivery, BioinfoTaskStatus.delivered],
          },
        },
      })
      if (remaining === 0) {
        await advanceProjectStatus(
          tx,
          operator,
          before.project,
          before.projectId,
          ProjectStatus.waiting_delivery,
          `bioinfo_task:${updated.taskNo}:submit`
        )
      }
    }

    return updated
  })
}

async function advanceProjectStatus(
  tx: Prisma.TransactionClient,
  operator: BioinfoTaskOperator,
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

export function handleBioinfoTaskDomainError(error: unknown) {
  if (error instanceof BioinfoTaskDomainError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  return null
}
