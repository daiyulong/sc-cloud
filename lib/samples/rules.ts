import {
  ProjectStatus,
  SampleBatchStatus,
  UserRole,
  type ProjectStatus as ProjectStatusValue,
  type SampleBatchStatus as SampleBatchStatusValue,
} from "@/lib/enums"

export type SampleAction = "receive" | "markAbnormal"

export class SampleDomainError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message)
    this.name = "SampleDomainError"
  }
}

// 角色边界（权限矩阵 §3.2：登记样本接收 = 管理员/项目经理/样本接收员）
export const sampleReceiveRoles = [
  UserRole.admin,
  UserRole.project_manager,
  UserRole.sample_receiver,
] as const

// 新增样本：销售在建项时登记预计样本，接收员对临时到样补登记
export const sampleCreateRoles = [
  UserRole.admin,
  UserRole.project_manager,
  UserRole.sample_receiver,
  UserRole.sales_owner,
] as const

/** 登记批次异常的前置状态（规格 §5.1：待到样/已接收） */
export const abnormalMarkableSampleStatuses: readonly SampleBatchStatusValue[] = [
  SampleBatchStatus.waiting_arrival,
  SampleBatchStatus.received,
]

/**
 * 允许登记样本接收的项目状态：待到样为主流程（§5.1），
 * 已到样/实验中允许同项目后续批次继续到样（聚合规则只在首个样本时改项目状态）。
 */
export const sampleReceivableProjectStatuses: readonly ProjectStatusValue[] = [
  ProjectStatus.waiting_sample,
  ProjectStatus.sample_received,
  ProjectStatus.lab_in_progress,
]

/** 项目终态/异常不允许再新增样本 */
export const sampleCreatableProjectBlockedStatuses: readonly ProjectStatusValue[] = [
  ProjectStatus.completed,
  ProjectStatus.terminated,
  ProjectStatus.abnormal,
]

export function ensureSampleRole(
  role: string | undefined,
  allowed: readonly string[],
  actionName = "该操作"
) {
  if (!role || !allowed.includes(role)) {
    throw new SampleDomainError(`${actionName}没有操作权限`, 403)
  }
}

export function ensureSampleStatus(
  current: SampleBatchStatusValue,
  allowed: readonly SampleBatchStatusValue[],
  actionName: string
) {
  if (!allowed.includes(current)) {
    throw new SampleDomainError(
      `${actionName}要求批次状态为：${allowed.join(", ")}，当前状态为：${current}`,
      409
    )
  }
}

export function ensureProjectCanReceiveSample(projectStatus: ProjectStatusValue) {
  if (!sampleReceivableProjectStatuses.includes(projectStatus)) {
    throw new SampleDomainError(
      `项目当前状态（${projectStatus}）不允许登记样本接收，请先由项目经理推进项目至待到样`,
      409
    )
  }
}

export function ensureProjectCanCreateSample(projectStatus: ProjectStatusValue) {
  if (sampleCreatableProjectBlockedStatuses.includes(projectStatus)) {
    throw new SampleDomainError(`项目当前状态（${projectStatus}）不允许新增样本`, 409)
  }
}

export function getAvailableSampleActions(
  status: SampleBatchStatusValue,
  role: string | undefined
): SampleAction[] {
  if (!role || !sampleReceiveRoles.includes(role as (typeof sampleReceiveRoles)[number])) {
    return []
  }

  const actions: SampleAction[] = []
  if (status === SampleBatchStatus.waiting_arrival) actions.push("receive")
  if (abnormalMarkableSampleStatuses.includes(status)) actions.push("markAbnormal")
  return actions
}
