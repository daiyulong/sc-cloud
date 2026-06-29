import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { buildProjectScope } from "@/lib/auth/role-scope"
import { bioinfoCreatableProjectStatuses } from "@/lib/bioinfo-tasks/rules"
import {
  BIOINFO_SERVICE_LEVELS,
  ExperimentTaskStatus,
  UserRole,
  type UserRole as UserRoleValue,
} from "@/lib/enums"

/** 创建生信任务时可选的实验任务：已完成、所属项目含生信且处于待生信/生信分析中、当前用户可见 */
export async function getBioinfoExperimentTaskOptions(
  operator: {
    id: string
    role?: UserRoleValue
  },
  filters: { projectId?: string | null } = {}
) {
  const clauses: Prisma.ExperimentTaskWhereInput[] = [
    { project: buildProjectScope(operator.role) },
    { status: ExperimentTaskStatus.completed },
    { project: { serviceLevel: { in: [...BIOINFO_SERVICE_LEVELS] } } },
    { project: { status: { in: [...bioinfoCreatableProjectStatuses] } } },
  ]
  if (filters.projectId) clauses.push({ projectId: filters.projectId })

  return prisma.experimentTask.findMany({
    where: { AND: clauses },
    select: {
      id: true,
      taskNo: true,
      experimentType: true,
      project: { select: { id: true, projectNo: true, customerOrg: true, serviceLevel: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  })
}

/** 分配/指派时可选的生信分析负责人（生信分析员，启用中） */
export async function getAnalystOptions() {
  return prisma.user.findMany({
    where: { role: UserRole.bioinfo_analyst, isActive: true },
    select: { id: true, name: true, department: true },
    orderBy: { name: "asc" },
  })
}
