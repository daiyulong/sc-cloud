import { prisma } from "@/lib/prisma"
import { buildProjectScope } from "@/lib/auth/role-scope"
import {
  taskCreatableProjectStatuses,
  taskCreatableSampleStatuses,
} from "@/lib/experiment-tasks/rules"
import { UserRole, type UserRole as UserRoleValue } from "@/lib/enums"

/** 创建实验任务时可选的样本：当前用户可见、已接收、且所属项目处于已到样/实验中 */
export async function getTaskSampleOptions(operator: { id: string; role?: UserRoleValue }) {
  return prisma.sample.findMany({
    where: {
      AND: [
        { project: buildProjectScope(operator.role, operator.id) },
        { status: { in: [...taskCreatableSampleStatuses] } },
        { project: { status: { in: [...taskCreatableProjectStatuses] } } },
      ],
    },
    select: {
      id: true,
      sampleNo: true,
      species: true,
      tissueType: true,
      experimentType: true,
      project: { select: { id: true, projectNo: true, customerOrg: true } },
    },
    orderBy: { updatedAt: "desc" },
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
