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

const salesEditableProjectStatuses = new Set<ProjectStatusValue>([
  ProjectStatus.draft,
  ProjectStatus.waiting_sample,
])

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
      samples: true,
      experimentTasks: true,
      bioinfoTasks: true,
    },
  },
} satisfies Prisma.ProjectInclude

function projectLogSelect(id: string) {
  return {
    entityType: "project",
    entityId: id,
  } satisfies Prisma.OperationLogWhereInput
}

function buildProjectListWhere(
  operator: ProjectOperator,
  query: ProjectListQuery
): Prisma.ProjectWhereInput {
  const filters: Prisma.ProjectWhereInput[] = [buildProjectScope(operator.role, operator.id)]

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
  if (query.status) {
    filters.push({ status: query.status })
  } else if (query.deliveryScope) {
    // 交付队列默认：待交付（确认交付即关闭项目，无独立「已交付」中间态）
    filters.push({ status: ProjectStatus.waiting_delivery })
  }
  if (query.serviceLevel) filters.push({ serviceLevel: query.serviceLevel })
  if (query.salesOwnerId) filters.push({ salesOwnerId: query.salesOwnerId })
  if (query.projectManagerId) filters.push({ projectManagerId: query.projectManagerId })
  if (query.due === "soon") {
    // 与工作台 dueSoonProjects 口径一致：未来 7 个自然日内预计交付且未关闭
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
  return { AND: [{ id }, buildProjectScope(operator.role, operator.id)] }
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

async function getWritableProject(id: string) {
  const project = await prisma.project.findUnique({ where: { id } })
  if (!project) throw new ProjectDomainError("项目不存在", 404)
  return project
}

function ensureCanUpdateProject(
  project: { salesOwnerId: string | null; status: ProjectStatusValue },
  operator: ProjectOperator
) {
  if (operator.role === UserRole.admin || operator.role === UserRole.project_manager) return

  if (
    operator.role === UserRole.sales_owner &&
    project.salesOwnerId === operator.id &&
    salesEditableProjectStatuses.has(project.status)
  ) {
    return
  }

  throw new ProjectDomainError("没有更新项目权限", 403)
}

export async function listProjects(
  operator: ProjectOperator,
  query: ProjectListQuery,
  pagination: { skip: number; limit: number }
) {
  const where = buildProjectListWhere(operator, query)
  const [data, total] = await Promise.all([
    prisma.project.findMany({
      where,
      include: projectInclude,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.project.count({ where }),
  ])

  return { data, total }
}

export async function getProjectDetail(operator: ProjectOperator, id: string) {
  const [project, operationLogs] = await Promise.all([
    prisma.project.findFirst({
      where: projectVisibleWhere(operator, id),
      include: projectInclude,
    }),
    prisma.operationLog.findMany({
      where: projectLogSelect(id),
      include: { operator: { select: projectUserSelect } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ])

  if (!project) throw new ProjectDomainError("项目不存在或无权访问", 404)
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
  ensureProjectRole(operator.role, [UserRole.admin, UserRole.project_manager], "恢复异常")
  const before = await getWritableProject(id)
  ensureProjectStatus(before.status, [ProjectStatus.abnormal], "恢复异常")
  if (!before.statusBeforeAbnormal) {
    throw new ProjectDomainError("缺少异常前状态，无法恢复", 400)
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
