import {
  ExperimentTaskStatus,
  ProjectStatus,
  SampleStatus,
  UserRole,
  type ExperimentTaskStatus as ExperimentTaskStatusValue,
  type ProjectStatus as ProjectStatusValue,
  type SampleStatus as SampleStatusValue,
} from "@/lib/enums"

export type ExperimentTaskAction = "schedule" | "start" | "finish" | "feedback" | "qc"

export class ExperimentTaskDomainError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message)
    this.name = "ExperimentTaskDomainError"
  }
}

/**
 * 实验任务全部动作的角色边界（§3.2：设置实验排期 / 录入质控 / 录入上机反馈 = 管理员/项目经理/实验执行员）。
 * 创建实验任务同样限这三类（接收员「可选」第一期不开，避免无关角色进入实验流）。
 */
export const experimentManageRoles = [
  UserRole.admin,
  UserRole.project_manager,
  UserRole.lab_operator,
] as const

/** 录入质控允许的任务执行态（进行中 / 待反馈；质控是业务判定，不改执行态） */
export const qcRecordableTaskStatuses: readonly ExperimentTaskStatusValue[] = [
  ExperimentTaskStatus.in_progress,
  ExperimentTaskStatus.waiting_feedback,
]

/** 提交实验反馈允许的前置态（进行中可直接提交，待反馈也可补提交） */
export const feedbackSubmittableTaskStatuses: readonly ExperimentTaskStatusValue[] = [
  ExperimentTaskStatus.in_progress,
  ExperimentTaskStatus.waiting_feedback,
]

/**
 * 录入产出指标（细胞核/测序量/捕获数/基因中位数）允许的角色（§6.8 经验视图）：
 * 实验管理三类 + 生信分析员（下机数据到手者）。这是补录动作、不推进工作流，
 * 故角色集与 experimentManageRoles 不同，独立于 getAvailableExperimentTaskActions。
 */
export const metricsRecordRoles = [
  UserRole.admin,
  UserRole.project_manager,
  UserRole.lab_operator,
  UserRole.bioinfo_analyst,
] as const

/** 录入产出指标的前置态：实验已完成（上机+测序后才有下机指标），可重复订正 */
export const metricsRecordableTaskStatuses: readonly ExperimentTaskStatusValue[] = [
  ExperimentTaskStatus.completed,
]

/** 可创建实验任务的项目状态（已到样为主流程，实验中允许同项目后续追加任务） */
export const taskCreatableProjectStatuses: readonly ProjectStatusValue[] = [
  ProjectStatus.sample_received,
  ProjectStatus.lab_in_progress,
]

/** 可创建实验任务的样本状态（须已接收；feedback_submitted/abnormal 不再建新任务） */
export const taskCreatableSampleStatuses: readonly SampleStatusValue[] = [
  SampleStatus.received,
  SampleStatus.received_abnormal,
  SampleStatus.waiting_task,
  SampleStatus.lab_in_progress,
]

export function ensureExperimentTaskRole(
  role: string | undefined,
  allowed: readonly string[] = experimentManageRoles,
  actionName = "该操作"
) {
  if (!role || !allowed.includes(role)) {
    throw new ExperimentTaskDomainError(`${actionName}没有操作权限`, 403)
  }
}

export function ensureExperimentTaskStatus(
  current: ExperimentTaskStatusValue,
  allowed: readonly ExperimentTaskStatusValue[],
  actionName: string
) {
  if (!allowed.includes(current)) {
    throw new ExperimentTaskDomainError(
      `${actionName}要求任务状态为：${allowed.join(", ")}，当前状态为：${current}`,
      409
    )
  }
}

export function ensureProjectCanCreateTask(projectStatus: ProjectStatusValue) {
  if (!taskCreatableProjectStatuses.includes(projectStatus)) {
    throw new ExperimentTaskDomainError(
      `项目当前状态（${projectStatus}）不允许创建实验任务，请先完成收样`,
      409
    )
  }
}

export function ensureSampleCanCreateTask(sampleStatus: SampleStatusValue) {
  if (!taskCreatableSampleStatuses.includes(sampleStatus)) {
    throw new ExperimentTaskDomainError(
      `样本当前状态（${sampleStatus}）不允许创建实验任务，请先接收样本`,
      409
    )
  }
}

/**
 * 当前状态 + 角色下可执行的语义动作（行内动作菜单与单测共用）。
 * 主动作 = 推进工作流的动作；录入质控 / 完成实验(待反馈) 进溢出菜单。
 */
export function getAvailableExperimentTaskActions(
  status: ExperimentTaskStatusValue,
  role: string | undefined
): ExperimentTaskAction[] {
  if (!role || !experimentManageRoles.includes(role as (typeof experimentManageRoles)[number])) {
    return []
  }

  switch (status) {
    case ExperimentTaskStatus.waiting_schedule:
      return ["schedule"]
    case ExperimentTaskStatus.scheduled:
      return ["start"]
    case ExperimentTaskStatus.in_progress:
      return ["feedback", "finish", "qc"]
    case ExperimentTaskStatus.waiting_feedback:
      return ["feedback", "qc"]
    default:
      return []
  }
}

/**
 * UI 判断：当前状态+角色是否可录入产出指标（§6.8）。
 * 两处入口共用——实验任务详情（实验员/PM 订正）与生信任务详情（分析员主录）。
 */
export function canRecordRunMetrics(
  status: ExperimentTaskStatusValue,
  role: string | undefined
): boolean {
  return (
    !!role &&
    metricsRecordRoles.includes(role as (typeof metricsRecordRoles)[number]) &&
    metricsRecordableTaskStatuses.includes(status)
  )
}
