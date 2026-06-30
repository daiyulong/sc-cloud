import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { buildProjectScope } from "@/lib/auth/role-scope"
import {
  taskCreatableProjectStatuses,
  taskCreatableSampleStatuses,
} from "@/lib/experiment-tasks/rules"
import { UserRole, type UserRole as UserRoleValue } from "@/lib/enums"

/** 创建实验任务时可选的样本：当前用户可见、已接收、且所属项目处于已到样/实验中 */
export async function getTaskSampleOptions(
  operator: { id: string; role?: UserRoleValue },
  filters: { projectId?: string | null; sampleBatchId?: string | null } = {}
) {
  const clauses: Prisma.SampleWhereInput[] = [
    { project: buildProjectScope(operator.role) },
    { status: { in: [...taskCreatableSampleStatuses] } },
    { project: { status: { in: [...taskCreatableProjectStatuses] } } },
  ]
  if (filters.projectId) clauses.push({ projectId: filters.projectId })
  if (filters.sampleBatchId) clauses.push({ batchId: filters.sampleBatchId })

  return prisma.sample.findMany({
    where: { AND: clauses },
    select: {
      id: true,
      sampleName: true,
      species: true,
      tissueType: true,
      batch: { select: { id: true, batchNo: true, experimentType: true, seq: true } },
      project: { select: { id: true, projectNo: true, customerOrg: true } },
    },
    // 按 YP 分组稳定排序：先按批次 seq，再按样本名（picker 内折叠后顺序稳定）
    orderBy: [{ batch: { seq: "asc" } }, { sampleName: "asc" }],
    take: 100,
  })
}

/** 排期/指派时可选的实验负责人（实验执行员，启用中） */
export async function getOperatorOptions() {
  return prisma.user.findMany({
    where: { role: UserRole.lab_operator, isActive: true },
    select: { id: true, name: true, department: true },
    orderBy: { name: "asc" },
  })
}
