import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildSampleBatchScope } from "@/lib/auth/role-scope"
import { canActAsStaff, staffRoles } from "@/lib/auth/action-roles"
import { recordOperation } from "@/lib/operation-log"
import {
  OperationAction,
  ProjectStatus,
  ReceiveStatus,
  SampleBatchStatus,
  SampleStatus,
  type SampleBatchStatus as SampleBatchStatusValue,
  type UserRole as UserRoleValue,
} from "@/lib/enums"
import type {
  MarkSampleAbnormalInput,
  ReceiveSampleInput,
  SampleListQuery,
  UpdateSampleInput,
} from "@/lib/schemas/sample"
import {
  SampleDomainError,
  abnormalMarkableSampleStatuses,
  ensureProjectCanReceiveSample,
  ensureSampleRole,
  ensureSampleStatus,
} from "@/lib/samples/rules"
import { compareDateOnly } from "@/lib/utils"

// 2026-06 重构：本「样本」域操作的是 SampleBatch（样本批次/YP）。收样 = 批次级登记 + 按数量生成样本叶子。
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

const batchLeafSelect = {
  id: true,
  sampleName: true,
  species: true,
  tissueType: true,
  status: true,
} satisfies Prisma.SampleSelect

const batchInclude = {
  project: { select: sampleProjectSelect },
  receiver: { select: sampleUserSelect },
  samples: { select: batchLeafSelect, orderBy: { createdAt: "asc" } },
} satisfies Prisma.SampleBatchInclude

function buildBatchListWhere(
  operator: SampleOperator,
  query: SampleListQuery,
  options?: { includeDraftProjects?: boolean }
): Prisma.SampleBatchWhereInput {
  const filters: Prisma.SampleBatchWhereInput[] = [buildSampleBatchScope(operator.role)]

  if (query.q) {
    filters.push({
      OR: [
        { batchNo: { contains: query.q, mode: "insensitive" } },
        { species: { contains: query.q, mode: "insensitive" } },
        { tissueType: { contains: query.q, mode: "insensitive" } },
        { project: { projectNo: { contains: query.q, mode: "insensitive" } } },
      ],
    })
  }
  if (query.status?.length) filters.push({ status: { in: query.status } })
  if (query.projectId) filters.push({ projectId: query.projectId })
  if (query.received === "1") filters.push({ receivedAt: { not: null } })
  if (!options?.includeDraftProjects) {
    filters.push({ project: { status: { not: ProjectStatus.draft } } })
  }

  return { AND: filters }
}

// 开放协作：写操作前置读不带 scope（可见性全员开放），权限由各动作的 ensureSampleRole / ensureCanUpdateBatch 承担。
async function getWritableBatch(id: string) {
  const batch = await prisma.sampleBatch.findUnique({
    where: { id },
    include: { project: { select: sampleProjectSelect } },
  })
  if (!batch) throw new SampleDomainError("样本批次不存在", 404)
  return batch
}

// 开放协作（2026-06）：全员在岗可订正任意样本批次，支持替班，不再限"本人项目/本人接收"。
function ensureCanUpdateBatch(
  _batch: {
    status: SampleBatchStatusValue
    receiverId: string | null
    project: { salesOwnerId: string | null }
  },
  operator: SampleOperator
) {
  if (canActAsStaff(operator.role)) return
  throw new SampleDomainError("没有更新样本批次权限", 403)
}

export async function listSamples(
  operator: SampleOperator,
  query: SampleListQuery,
  pagination: { skip: number; limit: number },
  options?: { includeDraftProjects?: boolean }
) {
  const where = buildBatchListWhere(operator, query, options)
  const [data, total] = await Promise.all([
    prisma.sampleBatch.findMany({
      where,
      include: batchInclude,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.sampleBatch.count({ where }),
  ])

  return { data, total }
}

export async function getSampleDetail(operator: SampleOperator, id: string) {
  const [batch, operationLogs] = await Promise.all([
    prisma.sampleBatch.findFirst({
      where: { AND: [{ id }, buildSampleBatchScope(operator.role)] },
      include: batchInclude,
    }),
    prisma.operationLog.findMany({
      where: { entityType: "sample_batch", entityId: id },
      include: { operator: { select: sampleUserSelect } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ])

  if (!batch) throw new SampleDomainError("样本批次不存在或无权访问", 404)
  return { sample: batch, operationLogs }
}

export async function updateSample(
  operator: SampleOperator,
  id: string,
  input: UpdateSampleInput
) {
  const before = await getWritableBatch(id)
  ensureCanUpdateBatch(before, operator)

  if (input.batchNo !== undefined) {
    const batchNo = input.batchNo?.trim() || null
    if (batchNo) {
      const clash = await prisma.sampleBatch.findFirst({
        where: { batchNo, id: { not: id } },
        select: { id: true },
      })
      if (clash) throw new SampleDomainError(`样本编号 ${batchNo} 已存在`, 409)
    }
  }

  const nextSamplingDate =
    input.samplingDate === undefined ? before.samplingDate : input.samplingDate
  const nextExpectedArrivalDate =
    input.expectedArrivalDate === undefined
      ? before.expectedArrivalDate
      : input.expectedArrivalDate
  if (compareDateOnly(nextExpectedArrivalDate, nextSamplingDate) === -1) {
    throw new SampleDomainError("预计到样日期不能早于客户取样日期", 409)
  }

  const data = Object.fromEntries(
    Object.entries({
      batchNo: input.batchNo === undefined ? undefined : input.batchNo?.trim() || null,
      species: input.species,
      tissueType: input.tissueType,
      sampleCount: input.sampleCount,
      experimentType: input.experimentType,
      transportCondition: input.transportCondition,
      samplingDate: input.samplingDate,
      expectedArrivalDate: input.expectedArrivalDate,
      remark: input.remark,
    }).filter(([, value]) => value !== undefined)
  ) as Prisma.SampleBatchUpdateInput

  return prisma.$transaction(async (tx) => {
    const updated = await tx.sampleBatch.update({
      where: { id },
      data,
      include: batchInclude,
    })

    await recordOperation({
      tx,
      entityType: "sample_batch",
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
 * 登记接收（规格 §5.1 + 重构 §5）：批次级登记到样 + 据数量生成 N 条样本叶子；
 * 项目下首个批次接收成功时 waiting_sample → sample_received（§7.1），同事务双双写操作日志。
 */
export async function receiveSample(
  operator: SampleOperator,
  id: string,
  input: ReceiveSampleInput
) {
  ensureSampleRole(operator.role, staffRoles, "登记接收")
  const before = await getWritableBatch(id)
  ensureSampleStatus(before.status, [SampleBatchStatus.waiting_arrival], "登记接收")
  ensureProjectCanReceiveSample(before.project.status)

  const batchNo = input.batchNo?.trim() || before.batchNo
  if (batchNo && batchNo !== before.batchNo) {
    const clash = await prisma.sampleBatch.findFirst({
      where: { batchNo, id: { not: id } },
      select: { id: true },
    })
    if (clash) throw new SampleDomainError(`样本编号 ${batchNo} 已存在`, 409)
  }

  const isAbnormal = input.receiveStatus === ReceiveStatus.abnormal
  const leafStatus = isAbnormal ? SampleStatus.received_abnormal : SampleStatus.received

  return prisma.$transaction(async (tx) => {
    const updated = await tx.sampleBatch.update({
      where: { id },
      data: {
        batchNo,
        species: input.species,
        tissueType: input.tissueType,
        experimentType: input.experimentType,
        transportCondition: input.transportCondition,
        sampleCount: input.sampleCount,
        receivedAt: input.receivedAt ?? new Date(),
        receiverId: operator.id,
        abnormalNote: input.abnormalNote ?? null,
        status: isAbnormal ? SampleBatchStatus.received_abnormal : SampleBatchStatus.received,
      },
      include: batchInclude,
    })

    // 据数量生成样本叶子（首次接收，批次此前 0 叶子）；样本名留空，经实验/多模态补
    const existing = await tx.sample.count({ where: { batchId: id } })
    const toCreate = Math.max(0, input.sampleCount - existing)
    if (toCreate > 0) {
      await tx.sample.createMany({
        data: Array.from({ length: toCreate }, () => ({
          batchId: id,
          projectId: before.projectId,
          species: input.species ?? null,
          tissueType: input.tissueType ?? null,
          status: leafStatus,
        })),
      })
    }

    await recordOperation({
      tx,
      entityType: "sample_batch",
      entityId: id,
      action: OperationAction.status_change,
      operatorId: operator.id,
      before,
      after: { batch: updated, leavesCreated: toCreate },
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
        after: { project: projectAfter, trigger: `sample_batch:${updated.batchNo ?? id}:receive` },
      })
    }

    return updated
  })
}

/**
 * 登记批次异常（规格 §5.1：待到样/已接收 → 异常接收）。
 * 只改批次状态，不联动项目异常——项目异常必须显式执行项目动作（避免污染异常统计）。
 */
export async function markSampleAbnormal(
  operator: SampleOperator,
  id: string,
  input: MarkSampleAbnormalInput
) {
  ensureSampleRole(operator.role, staffRoles, "登记批次异常")
  const before = await getWritableBatch(id)
  ensureSampleStatus(before.status, abnormalMarkableSampleStatuses, "登记批次异常")

  return prisma.$transaction(async (tx) => {
    const updated = await tx.sampleBatch.update({
      where: { id },
      data: {
        status: SampleBatchStatus.received_abnormal,
        abnormalNote: input.reason,
      },
      include: batchInclude,
    })

    await recordOperation({
      tx,
      entityType: "sample_batch",
      entityId: id,
      action: OperationAction.status_change,
      operatorId: operator.id,
      before,
      after: { batch: updated, reason: input.reason },
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
