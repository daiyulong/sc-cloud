import type { Prisma } from "@prisma/client"
import { UserRole } from "@/lib/enums"

/**
 * 行级数据可见范围（规格 §3.3）。返回 Project 的 where 片段，与用户筛选 AND 叠加：
 *   where: { AND: [ buildProjectScope(role, userId), userFilter ] }
 *
 * 注意：历史导入项目的人员字段（sales_owner_id/receiver_id/...）多为空，
 * 因此非全局角色对这些项目的「相关」判定恒为假——这是设计预期（回填关联后才可见）。
 * 所有列表 / 详情 / 导出 / 统计查询都必须叠加本 scope，别漏。
 */
export function buildProjectScope(
  role: UserRole | undefined,
  userId: string
): Prisma.ProjectWhereInput {
  switch (role) {
    case UserRole.admin:
    case UserRole.project_manager:
      return {} // 全部可见，无过滤
    case UserRole.sales_owner:
      return { salesOwnerId: userId }
    case UserRole.sample_receiver:
      return { samples: { some: { receiverId: userId } } }
    case UserRole.lab_operator:
      return { experimentTasks: { some: { operatorId: userId } } }
    case UserRole.bioinfo_analyst:
      return { bioinfoTasks: { some: { analystId: userId } } }
    case UserRole.viewer:
      return { projectGrants: { some: { userId } } } // 显式授权
    default:
      // 未知 / 缺失角色：fail-closed，什么都看不到
      return { id: "__none__" }
  }
}
