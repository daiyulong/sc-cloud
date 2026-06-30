import type { Prisma } from "@prisma/client"
import {
  BIOINFO_SERVICE_LEVELS,
  ExperimentTaskStatus,
  ProjectStatus,
  UserRole,
} from "@/lib/enums"

// 注：M1 时曾有 `samplesAwaitingTaskWhere`（叶子级「待建实验任务」where 片段）。
// M2 已迁移：「待建实验任务」语义以 ExperimentTask 列表 + waiting_schedule 状态承接，
// 不再挂样本列表 awaiting=task 筛选（见 tests/seam-queue.test.ts:45）。
// 此处不再导出死代码，tasksAwaitingBioinfoWhere 仍按原口径保留。

/**
 * 「待建生信任务」队列条件：实验已完成、所属项目含生信且在可建生信态、且尚无生信任务。
 * 供列表 `awaiting=bioinfo` 筛选、工位徽章计数共用（聚焦信号，非可见性墙）。
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
 * 行级可见范围（2026-06 反转规格 §3.3 的「安全横切」约定）。
 *
 * WHY：这是**公司内部提效系统**，全员是可信同事、无外部租户。为「看起来正规的权限」
 * 而按角色藏行只会制造摩擦（曾因此打断协作、被迫加一堆"鸡生蛋池例外/404 兜底"补丁）。
 * 故可见性**全员开放**——所有列表/详情/导出/统计对任何在册角色（含只读 viewer）一律可见，
 * 仅对未知/缺失角色 fail-closed。
 *
 * 「工位聚焦」改由正交机制承担：角色落地页（landingPathForRole）、队列/awaiting/需关注筛选、
 * 侧栏徽章（团队待办计数，谁都能接手）。**动作权限**仍按角色锁（见各 rules.ts），与可见性无关。
 */
function visibleScope<T extends { id?: unknown }>(role: UserRole | undefined): T {
  // 已知角色全可见（空 where）；未知/缺失角色什么都看不到（fail-closed）
  const known = !!role && (Object.values(UserRole) as string[]).includes(role)
  return (known ? {} : { id: "__none__" }) as T
}

export function buildProjectScope(role: UserRole | undefined): Prisma.ProjectWhereInput {
  return visibleScope<Prisma.ProjectWhereInput>(role)
}

export function buildSampleBatchScope(role: UserRole | undefined): Prisma.SampleBatchWhereInput {
  return visibleScope<Prisma.SampleBatchWhereInput>(role)
}

export function buildExperimentTaskScope(role: UserRole | undefined): Prisma.ExperimentTaskWhereInput {
  return visibleScope<Prisma.ExperimentTaskWhereInput>(role)
}

export function buildBioinfoTaskScope(role: UserRole | undefined): Prisma.BioinfoTaskWhereInput {
  return visibleScope<Prisma.BioinfoTaskWhereInput>(role)
}
