import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildProjectScope } from "@/lib/auth/role-scope"
import { recordOperation } from "@/lib/operation-log"
import {
  BioinfoTaskStatus,
  OperationAction,
  ProjectStatus,
  UserRole,
  type ProjectStatus as ProjectStatusValue,
  type UserRole as UserRoleValue,
} from "@/lib/enums"
import type {
  ConfirmProjectInput,
  CreateProjectInput,
  DeliverProjectInput,
  OptionalProjectReasonInput,
  ProjectListQuery,
  ProjectReasonInput,
  UpdateProjectInput,
} from "@/lib/schemas/project"
import {
  ProjectDomainError,
  ensureProjectCanMarkAbnormal,
  ensureProjectCanTerminate,
  ensureProjectRole,
  ensureProjectStatus,
} from "@/lib/projects/rules"

export type ProjectOperator = {
  id: string
  role?: UserRoleValue
}

// 项目头信息（客户/服务档次等）的拥有方：管理 + 销售。操作岗（收样/实验/生信）在各自实体上替班，
// 但不编辑项目头——这才是"不同工位关注不同信息"。与 createProject 同集。
const projectOwnerRoles: readonly string[] = [
  UserRole.admin,
  UserRole.project_manager,
  UserRole.sales_owner,
]

const projectUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  department: true,
  phone: true,
} satisfies Prisma.UserSelect

const projectInclude = {
  salesOwner: { select: projectUserSelect },
  projectManager: { select: projectUserSelect },
  _count: {
    select: {
      sampleBatches: true,
      experimentTasks: true,
      bioinfoTasks: true,
    },
  },
} satisfies Prisma.ProjectInclude

function buildProjectListWhere(
  operator: ProjectOperator,
  query: ProjectListQuery
): Prisma.ProjectWhereInput {
  const filters: Prisma.ProjectWhereInput[] = [buildProjectScope(operator.role)]

  if (query.q) {
    filters.push({
      OR: [
        { projectNo: { contains: query.q, mode: "insensitive" } },
        { contractNo: { contains: query.q, mode: "insensitive" } },
        { customerOrg: { contains: query.q, mode: "insensitive" } },
        { customerName: { contains: query.q, mode: "insensitive" } },
      ],
    })
  }
  if (query.status?.length) {
    filters.push({ status: { in: query.status } })
  }
  if (query.serviceLevel) filters.push({ serviceLevel: query.serviceLevel })
  if (query.salesOwnerId) filters.push({ salesOwnerId: query.salesOwnerId })
  if (query.projectManagerId) filters.push({ projectManagerId: query.projectManagerId })
  if (query.due === "soon") {
    // 与项目工位「需关注」/ 角标 dueSoon 口径一致：未来 7 个自然日内预计交付且未关闭
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    filters.push({
      expectedDeliveryDate: { gte: start, lt: end },
      status: { notIn: [ProjectStatus.completed, ProjectStatus.terminated] },
    })
  }

  return { AND: filters }
}

function projectVisibleWhere(
  operator: ProjectOperator,
  id: string
): Prisma.ProjectWhereInput {
  return { AND: [{ id }, buildProjectScope(operator.role)] }
}

function omitUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as Partial<T>
}

function toProjectUpdateData(input: UpdateProjectInput): Prisma.ProjectUpdateInput {
  const data = omitUndefined({
    contractNo: input.contractNo,
    customerOrg: input.customerOrg,
    customerName: input.customerName,
    customerContact: input.customerContact,
    projectType: input.projectType,
    serviceItems: input.serviceItems,
    serviceLevel: input.serviceLevel,
    sequencingPlatform: input.sequencingPlatform,
    priority: input.priority,
    expectedDeliveryDate: input.expectedDeliveryDate,
    remark: input.remark,
  }) as Prisma.ProjectUpdateInput

  if (input.salesOwnerId !== undefined) {
    data.salesOwner = input.salesOwnerId ? { connect: { id: input.salesOwnerId } } : { disconnect: true }
  }
  if (input.projectManagerId !== undefined) {
    data.projectManager = input.projectManagerId
      ? { connect: { id: input.projectManagerId } }
      : { disconnect: true }
  }

  return data
}

// 开放协作：写操作前置读不带 scope（可见性全员开放），权限由各动作的 ensureProjectRole 承担。
async function getWritableProject(id: string) {
  const project = await prisma.project.findUnique({ where: { id } })
  if (!project) throw new ProjectDomainError("项目不存在", 404)
  return project
}

// 开放协作（2026-06）：项目头由"项目拥有方"（管理+销售）编辑，放开销售"仅自己项目"的旧子限制；
// 不开给操作岗（编辑项目头不属替班动作）。
function ensureCanUpdateProject(
  _project: { salesOwnerId: string | null; status: ProjectStatusValue },
  operator: ProjectOperator
) {
  if (operator.role && projectOwnerRoles.includes(operator.role)) return
  throw new ProjectDomainError("没有更新项目权限", 403)
}

// 项目工位「需关注」：异常 > 待交付 > 草稿（同组按预计交付近的在前）。
// 这三态是各角色需主动推进的：异常待处理、待交付待确认关闭、草稿待销售/PM 补全确认。
export const ATTENTION_STATUSES: ProjectStatusValue[] = [
  ProjectStatus.abnormal,
  ProjectStatus.waiting_delivery,
  ProjectStatus.draft,
]
const ATTENTION_RANK: Record<string, number> = {
  [ProjectStatus.abnormal]: 0,
  [ProjectStatus.waiting_delivery]: 1,
  [ProjectStatus.draft]: 2,
}

/**
 * 工位置顶的需关注项目：按 scope 取三态、组内按预计交付近在前；不分页（已上限）。
 * statusIn 给定时再与之求交（多选状态筛选下，需关注组只显示仍被勾选的态）。
 */
export async function listAttentionProjects(
  operator: ProjectOperator,
  statusIn?: ProjectStatusValue[]
) {
  const statuses = statusIn
    ? ATTENTION_STATUSES.filter((s) => statusIn.includes(s))
    : ATTENTION_STATUSES
  if (statuses.length === 0) return []
  const rows = await prisma.project.findMany({
    where: {
      AND: [
        buildProjectScope(operator.role),
        { status: { in: statuses } },
      ],
    },
    include: projectInclude,
    take: 100,
  })
  return rows.sort((a, b) => {
    const rank = (ATTENTION_RANK[a.status] ?? 99) - (ATTENTION_RANK[b.status] ?? 99)
    if (rank !== 0) return rank
    const ad = a.expectedDeliveryDate?.getTime() ?? Number.POSITIVE_INFINITY
    const bd = b.expectedDeliveryDate?.getTime() ?? Number.POSITIVE_INFINITY
    return ad - bd
  })
}

export async function listProjects(
  operator: ProjectOperator,
  query: ProjectListQuery,
  pagination: { skip: number; limit: number },
  options?: { excludeStatuses?: ProjectStatusValue[]; order?: "recent" | "deliverySoon" }
) {
  const baseWhere = buildProjectListWhere(operator, query)
  const where = options?.excludeStatuses?.length
    ? { AND: [baseWhere, { status: { notIn: options.excludeStatuses } }] }
    : baseWhere
  const orderBy: Prisma.ProjectOrderByWithRelationInput[] =
    options?.order === "deliverySoon"
      ? [{ expectedDeliveryDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }]
      : [{ updatedAt: "desc" }, { createdAt: "desc" }]
  const [data, total] = await Promise.all([
    prisma.project.findMany({
      where,
      include: projectInclude,
      orderBy,
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.project.count({ where }),
  ])

  return { data, total }
}

export async function getProjectDetail(operator: ProjectOperator, id: string) {
  const project = await prisma.project.findFirst({
    where: projectVisibleWhere(operator, id),
    include: projectInclude,
  })
  if (!project) throw new ProjectDomainError("项目不存在或无权访问", 404)

  // 时间线 = 项目自身日志 + 子实体（批次/样本/实验任务/生信任务）日志汇总（CLAUDE.md / §6.10）
  const [batches, samples, tasks, bioinfos, deliveries] = await Promise.all([
    prisma.sampleBatch.findMany({ where: { projectId: id }, select: { id: true } }),
    prisma.sample.findMany({ where: { projectId: id }, select: { id: true } }),
    prisma.experimentTask.findMany({ where: { projectId: id }, select: { id: true } }),
    prisma.bioinfoTask.findMany({ where: { projectId: id }, select: { id: true } }),
    prisma.sequencingDelivery.findMany({ where: { projectId: id }, select: { id: true } }),
  ])
  const operationLogs = await prisma.operationLog.findMany({
    where: {
      OR: [
        { entityType: "project", entityId: id },
        { entityType: "sample_batch", entityId: { in: batches.map((b) => b.id) } },
        { entityType: "sample", entityId: { in: samples.map((s) => s.id) } },
        { entityType: "experiment_task", entityId: { in: tasks.map((t) => t.id) } },
        { entityType: "bioinfo_task", entityId: { in: bioinfos.map((b) => b.id) } },
        { entityType: "sequencing_delivery", entityId: { in: deliveries.map((d) => d.id) } },
      ],
    },
    include: { operator: { select: projectUserSelect } },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return { project, operationLogs }
}

export async function createProject(operator: ProjectOperator, input: CreateProjectInput) {
  ensureProjectRole(
    operator.role,
    [UserRole.admin, UserRole.sales_owner, UserRole.project_manager],
    "创建项目"
  )

  const salesOwnerId =
    operator.role === UserRole.sales_owner ? operator.id : input.salesOwnerId || null
  const projectManagerId =
    input.projectManagerId || (operator.role === UserRole.project_manager ? operator.id : null)

  // 进度式收集：建项目即生成 1 个空样本批次（0 叶子），样本编号(YP)/数量收样时补（重构 §5）。
  // WHY：收样工位的接缝队列需要一行可显示的待接收批次，对称于 projectNo-null 草稿。
  const batchNo = input.batchNo?.trim() || null
  if (batchNo) {
    const clash = await prisma.sampleBatch.findUnique({ where: { batchNo }, select: { id: true } })
    if (clash) throw new ProjectDomainError(`样本编号 ${batchNo} 已存在`, 409)
  }

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        // projectNo 草稿阶段为 null，PM 确认时录入
        contractNo: input.contractNo,
        customerOrg: input.customerOrg,
        customerName: input.customerName,
        customerContact: input.customerContact ?? null,
        salesOwnerId,
        projectManagerId,
        projectType: input.projectType,
        serviceItems: input.serviceItems,
        serviceLevel: input.serviceLevel,
        sequencingPlatform: input.sequencingPlatform ?? null,
        priority: input.priority,
        expectedDeliveryDate: input.expectedDeliveryDate ?? null,
        remark: input.remark ?? null,
      },
      include: projectInclude,
    })

    await recordOperation({
      tx,
      entityType: "project",
      entityId: project.id,
      action: OperationAction.create,
      operatorId: operator.id,
      after: project,
    })

    // 批次信息（物种/组织/实验类型/运输条件）收样时补；样本叶子收样时按数量生成
    const batch = await tx.sampleBatch.create({
      data: {
        projectId: project.id,
        batchNo,
        seq: 1,
        sampleCount: input.sampleCount ?? null,
      },
    })
    await recordOperation({
      tx,
      entityType: "sample_batch",
      entityId: batch.id,
      action: OperationAction.create,
      operatorId: operator.id,
      after: batch,
    })

    return project
  })
}

export async function updateProject(
  operator: ProjectOperator,
  id: string,
  input: UpdateProjectInput
) {
  const before = await getWritableProject(id)
  ensureCanUpdateProject(before, operator)

  const safeInput =
    operator.role === UserRole.sales_owner
      ? { ...input, salesOwnerId: undefined, projectManagerId: undefined }
      : input

  return prisma.$transaction(async (tx) => {
    const updated = await tx.project.update({
      where: { id },
      data: toProjectUpdateData(safeInput),
      include: projectInclude,
    })

    await recordOperation({
      tx,
      entityType: "project",
      entityId: id,
      action: OperationAction.update,
      operatorId: operator.id,
      before,
      after: updated,
    })

    return updated
  })
}

export async function deleteProject(operator: ProjectOperator, id: string) {
  ensureProjectRole(operator.role, [UserRole.admin], "删除项目")
  const before = await getWritableProject(id)

  await prisma.$transaction(async (tx) => {
    await tx.project.delete({ where: { id } })
    await recordOperation({
      tx,
      entityType: "project",
      entityId: id,
      action: OperationAction.delete,
      operatorId: operator.id,
      before,
    })
  })
}

export async function confirmProject(
  operator: ProjectOperator,
  id: string,
  input: ConfirmProjectInput
) {
  ensureProjectRole(operator.role, [UserRole.admin, UserRole.project_manager], "确认项目")
  const before = await getWritableProject(id)
  ensureProjectStatus(before.status, [ProjectStatus.draft], "确认项目")

  // 项目编号（委托单号）确认时录入并校验唯一
  const projectNo = input.projectNo.trim()
  const clash = await prisma.project.findFirst({
    where: { projectNo, id: { not: id } },
    select: { id: true },
  })
  if (clash) throw new ProjectDomainError(`项目编号 ${projectNo} 已存在`, 409)

  return prisma.$transaction(async (tx) => {
    const updated = await tx.project.update({
      where: { id },
      data: {
        projectNo,
        // 确认即进待到样（精简掉 confirmed 中间态 + 标记待到样空翻转）
        status: ProjectStatus.waiting_sample,
        projectManagerId:
          input.projectManagerId || (operator.role === UserRole.project_manager ? operator.id : before.projectManagerId),
        serviceLevel: input.serviceLevel ?? before.serviceLevel,
        priority: input.priority ?? before.priority,
        expectedDeliveryDate:
          input.expectedDeliveryDate === undefined
            ? before.expectedDeliveryDate
            : input.expectedDeliveryDate,
      },
      include: projectInclude,
    })

    await recordOperation({
      tx,
      entityType: "project",
      entityId: id,
      action: OperationAction.status_change,
      operatorId: operator.id,
      before,
      after: updated,
    })

    return updated
  })
}

export async function markProjectAbnormal(
  operator: ProjectOperator,
  id: string,
  input: ProjectReasonInput
) {
  ensureProjectRole(operator.role, [UserRole.admin, UserRole.project_manager], "标记异常")
  const before = await getWritableProject(id)
  ensureProjectCanMarkAbnormal(before.status)

  return updateProjectStatusWithLog(
    operator,
    before,
    {
      status: ProjectStatus.abnormal,
      statusBeforeAbnormal: before.status,
    },
    { reason: input.reason }
  )
}

export async function recoverProject(
  operator: ProjectOperator,
  id: string,
  input: OptionalProjectReasonInput
) {
  ensureProjectRole(operator.role, [UserRole.admin, UserRole.project_manager], "解除异常")
  const before = await getWritableProject(id)
  ensureProjectStatus(before.status, [ProjectStatus.abnormal], "解除异常")
  if (!before.statusBeforeAbnormal) {
    throw new ProjectDomainError("缺少异常前状态，无法解除异常", 400)
  }

  return updateProjectStatusWithLog(
    operator,
    before,
    {
      status: before.statusBeforeAbnormal,
      statusBeforeAbnormal: null,
    },
    { reason: input.reason }
  )
}

export async function terminateProject(
  operator: ProjectOperator,
  id: string,
  input: OptionalProjectReasonInput
) {
  ensureProjectRole(operator.role, [UserRole.admin, UserRole.project_manager], "异常终止")
  const before = await getWritableProject(id)
  ensureProjectCanTerminate(before.status)

  return updateProjectStatusWithLog(
    operator,
    before,
    {
      status: ProjectStatus.terminated,
      statusBeforeAbnormal: null,
    },
    { reason: input.reason }
  )
}

export async function deliverProject(
  operator: ProjectOperator,
  id: string,
  input: DeliverProjectInput
) {
  ensureProjectRole(operator.role, [UserRole.admin, UserRole.project_manager], "确认交付")
  const before = await getWritableProject(id)
  ensureProjectStatus(before.status, [ProjectStatus.waiting_delivery], "确认交付")
  const deliveredAt = input.deliveredAt ?? new Date()

  return prisma.$transaction(async (tx) => {
    const updated = await tx.project.update({
      where: { id: before.id },
      // 确认交付直接进终态（精简掉 delivered 中间态 + 完成项目空翻转）；deliveredAt 仍记录
      data: { status: ProjectStatus.completed, deliveredAt },
      include: projectInclude,
    })
    await recordOperation({
      tx,
      entityType: "project",
      entityId: before.id,
      action: OperationAction.status_change,
      operatorId: operator.id,
      before,
      after: updated,
    })

    // 级联：项目下待交付的生信任务 → 已交付，统一落报告交付日期（§7.4 / §8.9）
    const pendingBioinfo = await tx.bioinfoTask.findMany({
      where: { projectId: before.id, status: BioinfoTaskStatus.waiting_delivery },
    })
    for (const bioinfoTask of pendingBioinfo) {
      const bioinfoAfter = await tx.bioinfoTask.update({
        where: { id: bioinfoTask.id },
        data: { status: BioinfoTaskStatus.delivered, deliveredAt },
      })
      await recordOperation({
        tx,
        entityType: "bioinfo_task",
        entityId: bioinfoTask.id,
        action: OperationAction.status_change,
        operatorId: operator.id,
        before: bioinfoTask,
        after: { task: bioinfoAfter, trigger: `project:${updated.projectNo}:deliver` },
      })
    }

    return updated
  })
}

async function updateProjectStatusWithLog(
  operator: ProjectOperator,
  before: Awaited<ReturnType<typeof getWritableProject>>,
  data: Prisma.ProjectUpdateInput,
  context?: Record<string, unknown>
) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.project.update({
      where: { id: before.id },
      data,
      include: projectInclude,
    })

    await recordOperation({
      tx,
      entityType: "project",
      entityId: before.id,
      action: OperationAction.status_change,
      operatorId: operator.id,
      before,
      after: context ? { project: updated, ...context } : updated,
    })

    return updated
  })
}

export function handleProjectDomainError(error: unknown) {
  if (error instanceof ProjectDomainError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  return null
}
