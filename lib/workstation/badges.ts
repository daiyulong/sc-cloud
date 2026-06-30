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

// 各工位「待办」队列口径（可见范围 AND 状态条件）。
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

function countProjects(role: UserRoleValue) {
  return prisma.project.count({
    where: { AND: [buildProjectScope(role), { status: { in: ATTENTION_STATUSES } }] },
  })
}

function countIntake(role: UserRoleValue) {
  return prisma.sampleBatch.count({
    where: {
      AND: [buildSampleBatchScope(role), { status: SampleBatchStatus.waiting_arrival }],
    },
  })
}

function countLab(role: UserRoleValue) {
  return prisma.experimentTask.count({
    where: { AND: [buildExperimentTaskScope(role), { status: { in: LAB_OPEN_STATUSES } }] },
  })
}

async function countBioinfo(role: UserRoleValue) {
  // 待建（over ExperimentTask）+ 进行中（over BioinfoTask）= 生信工位两 tab 总待办
  const [pending, active] = await Promise.all([
    prisma.experimentTask.count({
      where: { AND: [buildExperimentTaskScope(role), tasksAwaitingBioinfoWhere] },
    }),
    prisma.bioinfoTask.count({
      where: { AND: [buildBioinfoTaskScope(role), { status: { in: BIOINFO_OPEN_STATUSES } }] },
    }),
  ])
  return pending + active
}

/**
 * 计算工位队列深度。开放协作（2026-06）：可见性全开放，故计数为**团队待办**（全量开放工作，
 * 谁都能接手），不再按本人过滤。按角色只决定**显示哪个工位的角标**（工位聚焦），管理员显示全部。
 */
export async function getWorkstationBadges(
  operator: { id: string; role?: UserRoleValue }
): Promise<WorkstationBadges> {
  const { role } = operator
  if (!role) return {}

  if (role === UserRole.admin) {
    const [projects, intake, lab, bioinfo] = await Promise.all([
      countProjects(role),
      countIntake(role),
      countLab(role),
      countBioinfo(role),
    ])
    return { projects, intake, lab, bioinfo }
  }

  switch (role) {
    case UserRole.sales_owner:
    case UserRole.project_manager:
      return { projects: await countProjects(role) }
    case UserRole.sample_receiver:
      return { intake: await countIntake(role) }
    case UserRole.lab_operator:
      return { lab: await countLab(role) }
    case UserRole.bioinfo_analyst:
      return { bioinfo: await countBioinfo(role) }
    default:
      return {}
  }
}
