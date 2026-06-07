import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildSampleScope, samplesAwaitingTaskWhere } from "@/lib/auth/role-scope"
import { recordOperation } from "@/lib/operation-log"
import {
  OperationAction,
  ProjectStatus,
  ReceiveStatus,
  SampleStatus,
  UserRole,
  type SampleStatus as SampleStatusValue,
  type UserRole as UserRoleValue,
} from "@/lib/enums"
import type {
  CreateSampleInput,
  MarkSampleAbnormalInput,
  ReceiveSampleInput,
  SampleListQuery,
  UpdateSampleInput,
} from "@/lib/schemas/sample"
import {
  SampleDomainError,
  abnormalMarkableSampleStatuses,
  ensureProjectCanCreateSample,
  ensureProjectCanReceiveSample,
  ensureSampleRole,
  ensureSampleStatus,
  sampleCreateRoles,
  sampleReceiveRoles,
} from "@/lib/samples/rules"

export type SampleOperator = {
  id: string
  role?: UserRoleValue
}

const sampleUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  department: true,
  phone: true,
} satisfies Prisma.UserSelect

const sampleProjectSelect = {
  id: true,
  projectNo: true,
  customerOrg: true,
  customerName: true,
  status: true,
  serviceLevel: true,
  salesOwnerId: true,
} satisfies Prisma.ProjectSelect

const sampleInclude = {
  project: { select: sampleProjectSelect },
  receiver: { select: sampleUserSelect },
} satisfies Prisma.SampleInclude

function buildSampleListWhere(
  operator: SampleOperator,
  query: SampleListQuery
): Prisma.SampleWhereInput {
  const filters: Prisma.SampleWhereInput[] = [buildSampleScope(operator.role, operator.id)]

  if (query.q) {
    filters.push({
      OR: [
        { sampleNo: { contains: query.q, mode: "insensitive" } },
        { species: { contains: query.q, mode: "insensitive" } },
        { tissueType: { contains: query.q, mode: "insensitive" } },
        { project: { projectNo: { contains: query.q, mode: "insensitive" } } },
      ],
    })
  }
  if (query.status) filters.push({ status: query.status })
  if (query.projectId) filters.push({ projectId: query.projectId })
  if (query.received === "1") filters.push({ receivedAt: { not: null } })
  if (query.awaiting === "task") filters.push(samplesAwaitingTaskWhere)

  return { AND: filters }
}

async function getWritableSample(id: string) {
  const sample = await prisma.sample.findUnique({
    where: { id },
    include: { project: { select: sampleProjectSelect } },
  })
  if (!sample) throw new SampleDomainError("样本不存在", 404)
  return sample
}

function ensureCanUpdateSample(
  sample: {
    status: SampleStatusValue
    receiverId: string | null
    project: { salesOwnerId: string | null }
  },
  operator: SampleOperator
) {
  if (operator.role === UserRole.admin || operator.role === UserRole.project_manager) return

  // 销售：自己项目下、且样本尚未接收（到样前修正预计信息）
  if (
    operator.role === UserRole.sales_owner &&
    sample.project.salesOwnerId === operator.id &&
    sample.status === SampleStatus.waiting_arrival
  ) {
    return
  }

  // 接收员：待到样样本（接收前修正）或自己接收的样本（修正接收登记信息）
  if (
    operator.role === UserRole.sample_receiver &&
    (sample.status === SampleStatus.waiting_arrival || sample.receiverId === operator.id)
  ) {
    return
  }

  throw new SampleDomainError("没有更新样本权限", 403)
}

export async function listSamples(
  operator: SampleOperator,
  query: SampleListQuery,
  pagination: { skip: number; limit: number }
) {
  const where = buildSampleListWhere(operator, query)
  const [data, total] = await Promise.all([
    prisma.sample.findMany({
      where,
      include: sampleInclude,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.sample.count({ where }),
  ])

  return { data, total }
}

export async function getSampleDetail(operator: SampleOperator, id: string) {
  const [sample, operationLogs] = await Promise.all([
    prisma.sample.findFirst({
      where: { AND: [{ id }, buildSampleScope(operator.role, operator.id)] },
      include: sampleInclude,
    }),
    prisma.operationLog.findMany({
      where: { entityType: "sample", entityId: id },
      include: { operator: { select: sampleUserSelect } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ])

  if (!sample) throw new SampleDomainError("样本不存在或无权访问", 404)
  return { sample, operationLogs }
}

export async function createSample(operator: SampleOperator, input: CreateSampleInput) {
  ensureSampleRole(operator.role, sampleCreateRoles, "新增样本")

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: sampleProjectSelect,
  })
  if (!project) throw new SampleDomainError("所属项目不存在", 404)

  // 销售只能在自己负责的项目下登记样本
  if (operator.role === UserRole.sales_owner && project.salesOwnerId !== operator.id) {
    throw new SampleDomainError("只能在自己负责的项目下新增样本", 403)
  }
  ensureProjectCanCreateSample(project.status)

  return prisma.$transaction(async (tx) => {
    const sample = await tx.sample.create({
      data: {
        sampleNo: input.sampleNo,
        projectId: input.projectId,
        species: input.species,
        tissueType: input.tissueType,
        sampleCount: input.sampleCount ?? null,
        experimentType: input.experimentType,
        transportCondition: input.transportCondition,
        samplingDate: input.samplingDate ?? null,
        expectedArrivalDate: input.expectedArrivalDate ?? null,
        remark: input.remark ?? null,
      },
      include: sampleInclude,
    })

    await recordOperation({
      tx,
      entityType: "sample",
      entityId: sample.id,
      action: OperationAction.create,
      operatorId: operator.id,
      after: sample,
    })

    return sample
  })
}

export async function updateSample(
  operator: SampleOperator,
  id: string,
  input: UpdateSampleInput
) {
  const before = await getWritableSample(id)
  ensureCanUpdateSample(before, operator)

  const data = Object.fromEntries(
    Object.entries({
      sampleNo: input.sampleNo,
      species: input.species,
      tissueType: input.tissueType,
      sampleCount: input.sampleCount,
      experimentType: input.experimentType,
      transportCondition: input.transportCondition,
      samplingDate: input.samplingDate,
      expectedArrivalDate: input.expectedArrivalDate,
      remark: input.remark,
    }).filter(([, value]) => value !== undefined)
  ) as Prisma.SampleUpdateInput

  return prisma.$transaction(async (tx) => {
    const updated = await tx.sample.update({
      where: { id },
      data,
      include: sampleInclude,
    })

    await recordOperation({
      tx,
      entityType: "sample",
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
 * 接收样本（规格 §5.1）：更新样本接收信息，并在同一事务内聚合项目状态——
 * 项目下首个样本接收成功时 waiting_sample → sample_received（规格 §7.1），双双写操作日志。
 */
export async function receiveSample(
  operator: SampleOperator,
  id: string,
  input: ReceiveSampleInput
) {
  ensureSampleRole(operator.role, sampleReceiveRoles, "接收样本")
  const before = await getWritableSample(id)
  ensureSampleStatus(before.status, [SampleStatus.waiting_arrival], "接收样本")
  ensureProjectCanReceiveSample(before.project.status)

  const isAbnormal = input.receiveStatus === ReceiveStatus.abnormal

  return prisma.$transaction(async (tx) => {
    const updated = await tx.sample.update({
      where: { id },
      data: {
        // 登记接收：补全建项目时缺的样本信息 + 记录到样
        species: input.species,
        tissueType: input.tissueType,
        experimentType: input.experimentType,
        transportCondition: input.transportCondition,
        sampleCount: input.sampleCount ?? before.sampleCount,
        receivedAt: input.receivedAt ?? new Date(),
        receiverId: operator.id,
        receiveStatus: input.receiveStatus,
        abnormalNote: input.abnormalNote ?? null,
        status: isAbnormal ? SampleStatus.received_abnormal : SampleStatus.received,
      },
      include: sampleInclude,
    })

    await recordOperation({
      tx,
      entityType: "sample",
      entityId: id,
      action: OperationAction.status_change,
      operatorId: operator.id,
      before,
      after: updated,
    })

    if (before.project.status === ProjectStatus.waiting_sample) {
      const projectAfter = await tx.project.update({
        where: { id: before.projectId },
        data: { status: ProjectStatus.sample_received },
      })

      await recordOperation({
        tx,
        entityType: "project",
        entityId: before.projectId,
        action: OperationAction.status_change,
        operatorId: operator.id,
        before: before.project,
        after: { project: projectAfter, trigger: `sample:${updated.sampleNo}:receive` },
      })
    }

    return updated
  })
}

/**
 * 登记样本异常（规格 §5.1：待到样/已接收 → 异常）。
 * 只改样本状态，不联动项目异常——项目异常必须显式执行项目动作（避免污染异常统计）。
 */
export async function markSampleAbnormal(
  operator: SampleOperator,
  id: string,
  input: MarkSampleAbnormalInput
) {
  ensureSampleRole(operator.role, sampleReceiveRoles, "登记样本异常")
  const before = await getWritableSample(id)
  ensureSampleStatus(before.status, abnormalMarkableSampleStatuses, "登记样本异常")

  return prisma.$transaction(async (tx) => {
    const updated = await tx.sample.update({
      where: { id },
      data: {
        status: SampleStatus.abnormal,
        abnormalNote: input.reason,
      },
      include: sampleInclude,
    })

    await recordOperation({
      tx,
      entityType: "sample",
      entityId: id,
      action: OperationAction.status_change,
      operatorId: operator.id,
      before,
      after: { sample: updated, reason: input.reason },
    })

    return updated
  })
}

export function handleSampleDomainError(error: unknown) {
  if (error instanceof SampleDomainError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  return null
}
