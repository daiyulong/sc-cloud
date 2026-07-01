import {
  ExperimentTaskStatus,
  ProjectStatus,
  SampleStatus,
  type ExperimentTaskStatus as ExperimentTaskStatusValue,
  type ProjectStatus as ProjectStatusValue,
  type SampleStatus as SampleStatusValue,
} from "@/lib/enums"
import { canActAsStaff, staffRoles } from "@/lib/auth/action-roles"

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
 * 录入质控允许的任务执行态：进行中 / 待提交结果 / 已完成。质控是业务判定、不改执行态。
 * 含 completed 是为「补录」——若提交结果（→已完成）前漏填质控，仍可事后补，避免一旦完成就再也填不了。
 */
export const qcRecordableTaskStatuses: readonly ExperimentTaskStatusValue[] = [
  ExperimentTaskStatus.in_progress,
  ExperimentTaskStatus.waiting_feedback,
  ExperimentTaskStatus.completed,
]

/** 提交实验结果允许的前置态（进行中可直接提交，待提交结果也可补提交） */
export const feedbackSubmittableTaskStatuses: readonly ExperimentTaskStatusValue[] = [
  ExperimentTaskStatus.in_progress,
  ExperimentTaskStatus.waiting_feedback,
]

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
  allowed: readonly string[] = staffRoles,
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
 * 主动作 = 推进工作流的动作；录入质控 / 完成实验(待提交结果) 进溢出菜单。
 */
export function getAvailableExperimentTaskActions(
  status: ExperimentTaskStatusValue,
  role: string | undefined
): ExperimentTaskAction[] {
  if (!canActAsStaff(role)) {
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
    canActAsStaff(role) &&
    metricsRecordableTaskStatuses.includes(status)
  )
}

/**
 * UI 判断：当前状态+角色是否可录入质控。与产出指标同为 section 级补录入口
 * （含 completed 补录），独立于工作流动作菜单 `getAvailableExperimentTaskActions`。
 */
export function canRecordQc(
  status: ExperimentTaskStatusValue,
  role: string | undefined
): boolean {
  return (
    canActAsStaff(role) &&
    qcRecordableTaskStatuses.includes(status)
  )
}
