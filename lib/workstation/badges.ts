import { prisma } from "@/lib/prisma"
import {
  buildBioinfoTaskScope,
  buildExperimentTaskScope,
  buildProjectScope,
  buildSampleBatchScope,
  tasksAwaitingBioinfoWhere,
} from "@/lib/auth/role-scope"
import { ATTENTION_STATUSES } from "@/lib/projects/service"
import {
  BioinfoTaskStatus,
  ExperimentTaskStatus,
  SampleBatchStatus,
  UserRole,
  type UserRole as UserRoleValue,
} from "@/lib/enums"

/** 侧栏队列深度角标：按导航项 key 映射计数（只渲染 > 0 的）。 */
export type WorkstationBadges = Partial<Record<"projects" | "intake" | "lab" | "bioinfo", number>>

// 各工位「待办」队列口径（行级 scope AND 状态条件）。
const LAB_OPEN_STATUSES = [
  ExperimentTaskStatus.waiting_schedule,
  ExperimentTaskStatus.scheduled,
  ExperimentTaskStatus.in_progress,
  ExperimentTaskStatus.waiting_feedback,
]
const BIOINFO_OPEN_STATUSES = [
  BioinfoTaskStatus.pending,
  BioinfoTaskStatus.in_progress,
  BioinfoTaskStatus.waiting_review,
]

function countProjects(role: UserRoleValue, userId: string) {
  return prisma.project.count({
    where: { AND: [buildProjectScope(role, userId), { status: { in: ATTENTION_STATUSES } }] },
  })
}

function countIntake(role: UserRoleValue, userId: string) {
  return prisma.sampleBatch.count({
    where: {
      AND: [buildSampleBatchScope(role, userId), { status: SampleBatchStatus.waiting_arrival }],
    },
  })
}

function countLab(role: UserRoleValue, userId: string) {
  return prisma.experimentTask.count({
    where: { AND: [buildExperimentTaskScope(role, userId), { status: { in: LAB_OPEN_STATUSES } }] },
  })
}

async function countBioinfo(role: UserRoleValue, userId: string) {
  // 待建（over ExperimentTask）+ 进行中（over BioinfoTask）= 生信工位两 tab 总待办
  const [pending, active] = await Promise.all([
    prisma.experimentTask.count({
      where: { AND: [buildExperimentTaskScope(role, userId), tasksAwaitingBioinfoWhere] },
    }),
    prisma.bioinfoTask.count({
      where: { AND: [buildBioinfoTaskScope(role, userId), { status: { in: BIOINFO_OPEN_STATUSES } }] },
    }),
  ])
  return pending + active
}

/**
 * 计算当前用户相关工位的队列深度。只算本角色相关工位（管理员算全部）以省查询；
 * 复用 role-scope 片段，与列表/工位口径同源。
 */
export async function getWorkstationBadges(
  operator: { id: string; role?: UserRoleValue }
): Promise<WorkstationBadges> {
  const { id, role } = operator
  if (!role) return {}

  if (role === UserRole.admin) {
    const [projects, intake, lab, bioinfo] = await Promise.all([
      countProjects(role, id),
      countIntake(role, id),
      countLab(role, id),
      countBioinfo(role, id),
    ])
    return { projects, intake, lab, bioinfo }
  }

  switch (role) {
    case UserRole.sales_owner:
    case UserRole.project_manager:
      return { projects: await countProjects(role, id) }
    case UserRole.sample_receiver:
      return { intake: await countIntake(role, id) }
    case UserRole.lab_operator:
      return { lab: await countLab(role, id) }
    case UserRole.bioinfo_analyst:
      return { bioinfo: await countBioinfo(role, id) }
    default:
      return {}
  }
}
