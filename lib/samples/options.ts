import { prisma } from "@/lib/prisma"
import { buildProjectScope } from "@/lib/auth/role-scope"
import { sampleCreatableProjectBlockedStatuses } from "@/lib/samples/rules"
import type { UserRole } from "@/lib/enums"

/** 新建样本时可选的项目（当前用户可见、且未处于终态/异常），按最近更新排序 */
export async function getSampleProjectOptions(operator: { id: string; role?: UserRole }) {
  return prisma.project.findMany({
    where: {
      AND: [
        buildProjectScope(operator.role),
        { status: { notIn: [...sampleCreatableProjectBlockedStatuses] } },
      ],
    },
    select: {
      id: true,
      projectNo: true,
      customerOrg: true,
      status: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  })
}
