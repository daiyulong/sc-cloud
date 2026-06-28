import type { Prisma } from "@prisma/client"
import {
  BIOINFO_SERVICE_LEVELS,
  BioinfoTaskStatus,
  ExperimentTaskStatus,
  ProjectStatus,
  SampleBatchStatus,
  SampleStatus,
  UserRole,
} from "@/lib/enums"

/**
 * 「待建实验任务」队列条件：已接收、所属项目在可建任务态、且尚无实验任务。
 * 供行级 scope（实验员 pool 例外）、列表 `awaiting=task` 筛选、工作台计数共用，确保三者口径一致。
 */
export const samplesAwaitingTaskWhere: Prisma.SampleWhereInput = {
  status: {
    in: [
      SampleStatus.received,
      SampleStatus.received_abnormal,
      SampleStatus.waiting_task,
      SampleStatus.lab_in_progress,
    ],
  },
  // 叶子是否已进某次上机：经 TaskSample 关联（旧 Sample→ExperimentTask 直连已退役）
  taskSamples: { none: {} },
  project: { status: { in: [ProjectStatus.sample_received, ProjectStatus.lab_in_progress] } },
}

/**
 * 「待建生信任务」队列条件：实验已完成、所属项目含生信且在可建生信态、且尚无生信任务。
 * 供行级 scope（分析员 pool 例外）、列表 `awaiting=bioinfo` 筛选、工作台计数共用。
 */
export const tasksAwaitingBioinfoWhere: Prisma.ExperimentTaskWhereInput = {
  status: ExperimentTaskStatus.completed,
  bioinfoTasks: { none: {} },
  project: {
    serviceLevel: { in: [...BIOINFO_SERVICE_LEVELS] },
    status: { in: [ProjectStatus.waiting_bioinfo, ProjectStatus.bioinfo_in_progress] },
  },
}

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
      // 接收记录迁到批次：项目下有自己接收过的批次即相关
      return { sampleBatches: { some: { receiverId: userId } } }
    case UserRole.lab_operator:
      return { experimentTasks: { some: { operatorId: userId } } }
    case UserRole.bioinfo_analyst:
      return { bioinfoTasks: { some: { analystId: userId } } }
    case UserRole.viewer:
      // 第一期 viewer 简化为全局只读；终局若需按项目授权，通过 projectGrants 关联表实现。
      // 参见 CLAUDE.md 需求评审结论，viewer 的「授权范围」不可落地——无授权 UI/API。
      return {}
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
      // 叶子无 receiverId，接收记录在批次：自己接收过的批次下的叶子 ∪ 全部待到样叶子
      return {
        OR: [{ batch: { receiverId: userId } }, { status: SampleStatus.waiting_arrival }],
      }
    case UserRole.lab_operator:
      // 鸡生蛋同实验任务池：实验员要建任务，却看不到尚无任务的已收样本——补「待建任务样本池」
      return { OR: [{ project: buildProjectScope(role, userId) }, samplesAwaitingTaskWhere] }
    default:
      return { project: buildProjectScope(role, userId) }
  }
}

/**
 * 样本批次的行级可见范围（收样工位 = 批次队列）。接收记录在批次上。
 *
 * 接收员鸡生蛋同旧样本逻辑：receiver_id 接收时才填，只按它过滤永远看不到待接收批次；
 * 故接收员可见 = 自己接收过的批次 ∪ 全部待到样批次。其余角色由项目 scope 推导。
 */
export function buildSampleBatchScope(
  role: UserRole | undefined,
  userId: string
): Prisma.SampleBatchWhereInput {
  switch (role) {
    case UserRole.sample_receiver:
      return {
        OR: [{ receiverId: userId }, { status: SampleBatchStatus.waiting_arrival }],
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
    case UserRole.bioinfo_analyst:
      // 鸡生蛋同实验员：分析员要建生信任务，却看不到尚无生信任务的完成实验任务——补「待建生信池」
      return { OR: [{ project: buildProjectScope(role, userId) }, tasksAwaitingBioinfoWhere] }
    default:
      return { project: buildProjectScope(role, userId) }
  }
}

/**
 * 生信任务的行级可见范围。除生信分析员外都由项目 scope 推导。
 *
 * 生信分析员特殊（同实验员鸡生蛋）：项目 scope（bioinfo_tasks.some.analystId=me）对
 * 刚创建、尚未指派分析员的待开始任务恒为假。因此分析员可见 = 自己负责 ∪ 全部待开始任务池。
 */
export function buildBioinfoTaskScope(
  role: UserRole | undefined,
  userId: string
): Prisma.BioinfoTaskWhereInput {
  switch (role) {
    case UserRole.bioinfo_analyst:
      return {
        OR: [{ analystId: userId }, { status: BioinfoTaskStatus.pending }],
      }
    default:
      return { project: buildProjectScope(role, userId) }
  }
}
