import type { Prisma } from "@prisma/client"
import { ExperimentTaskStatus, SampleStatus, UserRole } from "@/lib/enums"

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

/**
 * 样本的行级可见范围。除接收员外都由项目 scope 推导（销售=自己项目下样本等）。
 *
 * 接收员特殊：§3.3 的项目 scope（samples.some.receiverId=me）在样本层会鸡生蛋——
 * receiver_id 在接收动作时才填充，只按它过滤接收员永远看不到待接收样本、无法完成首次接收；
 * 且工作台规格 §6.2 明确要求接收员可见「今日预计到样、待接收样本」。
 * 因此接收员可见 = 自己接收过的样本 ∪ 全部待到样样本。
 */
export function buildSampleScope(
  role: UserRole | undefined,
  userId: string
): Prisma.SampleWhereInput {
  switch (role) {
    case UserRole.sample_receiver:
      return {
        OR: [{ receiverId: userId }, { status: SampleStatus.waiting_arrival }],
      }
    default:
      return { project: buildProjectScope(role, userId) }
  }
}

/**
 * 实验任务的行级可见范围。除实验执行员外都由项目 scope 推导。
 *
 * 实验执行员特殊（同接收员鸡生蛋）：§3.3 项目 scope（experiment_tasks.some.operatorId=me）
 * 对刚由项目经理创建、尚未指派负责人的待排期任务恒为假，实验员将看不到任务、无法设置排期/认领。
 * §6.5 又要求实验员可见「待排期任务池」。因此实验员可见 = 自己负责的任务 ∪ 全部待排期任务。
 */
export function buildExperimentTaskScope(
  role: UserRole | undefined,
  userId: string
): Prisma.ExperimentTaskWhereInput {
  switch (role) {
    case UserRole.lab_operator:
      return {
        OR: [{ operatorId: userId }, { status: ExperimentTaskStatus.waiting_schedule }],
      }
    default:
      return { project: buildProjectScope(role, userId) }
  }
}
