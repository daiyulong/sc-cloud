import {
  BioinfoTaskStatus,
  ExperimentTaskStatus,
  ProjectStatus,
  UserRole,
  type BioinfoTaskStatus as BioinfoTaskStatusValue,
  type ExperimentTaskStatus as ExperimentTaskStatusValue,
  type ProjectStatus as ProjectStatusValue,
  type ServiceLevel as ServiceLevelValue,
} from "@/lib/enums"
import { BIOINFO_SERVICE_LEVELS } from "@/lib/enums"

export type BioinfoTaskAction = "start" | "review" | "submit"

export class BioinfoTaskDomainError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message)
    this.name = "BioinfoTaskDomainError"
  }
}

/** 创建生信任务的角色边界（§3.2：管理员/项目经理/实验执行员/生信分析员） */
export const bioinfoCreateRoles = [
  UserRole.admin,
  UserRole.project_manager,
  UserRole.lab_operator,
  UserRole.bioinfo_analyst,
] as const

/** 更新分析状态（开始/审核/提交报告）的角色边界（§3.2：管理员/项目经理/生信分析员） */
export const bioinfoManageRoles = [
  UserRole.admin,
  UserRole.project_manager,
  UserRole.bioinfo_analyst,
] as const

/** 提交报告允许的前置态（分析中可直接提交，待审核也可提交） */
export const submittableBioinfoStatuses: readonly BioinfoTaskStatusValue[] = [
  BioinfoTaskStatus.in_progress,
  BioinfoTaskStatus.waiting_review,
]

/** 可创建生信任务的项目状态（待生信为主流程，生信分析中允许追加） */
export const bioinfoCreatableProjectStatuses: readonly ProjectStatusValue[] = [
  ProjectStatus.waiting_bioinfo,
  ProjectStatus.bioinfo_in_progress,
]

export function ensureBioinfoRole(
  role: string | undefined,
  allowed: readonly string[],
  actionName = "该操作"
) {
  if (!role || !allowed.includes(role)) {
    throw new BioinfoTaskDomainError(`${actionName}没有操作权限`, 403)
  }
}

export function ensureBioinfoStatus(
  current: BioinfoTaskStatusValue,
  allowed: readonly BioinfoTaskStatusValue[],
  actionName: string
) {
  if (!allowed.includes(current)) {
    throw new BioinfoTaskDomainError(
      `${actionName}要求分析状态为：${allowed.join(", ")}，当前状态为：${current}`,
      409
    )
  }
}

/** 项目须含生信服务（standard/advanced）才允许建生信任务 */
export function ensureServiceHasBioinfo(serviceLevel: ServiceLevelValue) {
  if (!BIOINFO_SERVICE_LEVELS.includes(serviceLevel)) {
    throw new BioinfoTaskDomainError(
      `该项目服务档次（${serviceLevel}）不含生信分析，无需创建生信任务`,
      409
    )
  }
}

export function ensureProjectCanCreateBioinfo(projectStatus: ProjectStatusValue) {
  if (!bioinfoCreatableProjectStatuses.includes(projectStatus)) {
    throw new BioinfoTaskDomainError(
      `项目当前状态（${projectStatus}）不允许创建生信任务，请先完成实验进入待生信`,
      409
    )
  }
}

/** 关联的实验任务必须已完成 */
export function ensureExperimentTaskCompleted(status: ExperimentTaskStatusValue) {
  if (status !== ExperimentTaskStatus.completed) {
    throw new BioinfoTaskDomainError("关联实验任务尚未完成，不能创建生信任务", 409)
  }
}

/**
 * 当前状态 + 角色下可执行的语义动作（行内动作菜单与单测共用）。
 * 主动作 = 推进工作流；提交审核（待审核）为可选中间步。
 */
export function getAvailableBioinfoTaskActions(
  status: BioinfoTaskStatusValue,
  role: string | undefined
): BioinfoTaskAction[] {
  if (!role || !bioinfoManageRoles.includes(role as (typeof bioinfoManageRoles)[number])) {
    return []
  }

  switch (status) {
    case BioinfoTaskStatus.pending:
      return ["start"]
    case BioinfoTaskStatus.in_progress:
      return ["submit", "review"]
    case BioinfoTaskStatus.waiting_review:
      return ["submit"]
    default:
      return []
  }
}
