import {
  ExperimentTaskStatus,
  ProjectStatus,
  SampleStatus,
  type ExperimentTaskStatus as ExperimentTaskStatusValue,
  type ProjectStatus as ProjectStatusValue,
  type SampleStatus as SampleStatusValue,
} from "@/lib/enums"
import { staffRoles } from "@/lib/auth/action-roles"

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
 * 实验任务全部动作（排期/开始/完成/反馈/质控/建任务）的角色边界。
 * 开放协作（2026-06）：上机实验是"谁在做谁记"的操作动作，全员在岗可做（除 viewer），支持替班。
 * 名为 manage 仅为兼容历史调用点，实际放开为 staffRoles。
 */
export const experimentManageRoles = staffRoles

/**
 * 录入质控允许的任务执行态：进行中 / 待反馈 / 已完成。质控是业务判定、不改执行态。
 * 含 completed 是为「补录」——若提交反馈（→已完成）前漏填质控，仍可事后补，避免一旦完成就再也填不了。
 */
export const qcRecordableTaskStatuses: readonly ExperimentTaskStatusValue[] = [
  ExperimentTaskStatus.in_progress,
  ExperimentTaskStatus.waiting_feedback,
  ExperimentTaskStatus.completed,
]

/** 提交实验反馈允许的前置态（进行中可直接提交，待反馈也可补提交） */
export const feedbackSubmittableTaskStatuses: readonly ExperimentTaskStatusValue[] = [
  ExperimentTaskStatus.in_progress,
  ExperimentTaskStatus.waiting_feedback,
]

/**
 * 录入产出指标（细胞核/测序量/捕获数/基因中位数）允许的角色（§6.8 经验视图）：补录动作、不推进工作流。
 * 开放协作（2026-06）：全员在岗可补录（除 viewer）。
 */
export const metricsRecordRoles = staffRoles

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

/**
 * UI 判断：当前状态+角色是否可录入质控。与产出指标同为 section 级补录入口
 * （含 completed 补录），独立于工作流动作菜单 `getAvailableExperimentTaskActions`。
 */
export function canRecordQc(
  status: ExperimentTaskStatusValue,
  role: string | undefined
): boolean {
  return (
    !!role &&
    experimentManageRoles.includes(role as (typeof experimentManageRoles)[number]) &&
    qcRecordableTaskStatuses.includes(status)
  )
}
