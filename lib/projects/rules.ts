import { ProjectStatus, UserRole, type ProjectStatus as ProjectStatusValue } from "@/lib/enums"

export type ProjectAction =
  | "confirm"
  | "markWaitingSample"
  | "markAbnormal"
  | "recover"
  | "terminate"
  | "deliver"
  | "complete"

export class ProjectDomainError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message)
    this.name = "ProjectDomainError"
  }
}

export const terminalProjectStatuses = new Set<ProjectStatusValue>([
  ProjectStatus.completed,
  ProjectStatus.terminated,
])

export function isTerminalProjectStatus(status: ProjectStatusValue) {
  return terminalProjectStatuses.has(status)
}

export function ensureProjectRole(
  role: string | undefined,
  allowed: readonly string[],
  actionName = "该操作"
) {
  if (!role || !allowed.includes(role)) {
    throw new ProjectDomainError(`${actionName}没有操作权限`, 403)
  }
}

export function ensureProjectStatus(
  current: ProjectStatusValue,
  allowed: readonly ProjectStatusValue[],
  actionName: string
) {
  if (!allowed.includes(current)) {
    throw new ProjectDomainError(
      `${actionName}要求项目状态为：${allowed.join(", ")}，当前状态为：${current}`,
      409
    )
  }
}

export function ensureProjectCanMarkAbnormal(status: ProjectStatusValue) {
  if (status === ProjectStatus.abnormal || isTerminalProjectStatus(status)) {
    throw new ProjectDomainError("当前项目状态不能标记异常", 409)
  }
}

export function ensureProjectCanTerminate(status: ProjectStatusValue) {
  if (isTerminalProjectStatus(status)) {
    throw new ProjectDomainError("当前项目已是终态，不能终止", 409)
  }
}

export function canManageProjectActions(role: string | undefined) {
  return role === UserRole.admin || role === UserRole.project_manager
}

export function getAvailableProjectActions(
  status: ProjectStatusValue,
  role: string | undefined
): ProjectAction[] {
  if (!canManageProjectActions(role)) return []

  const actions: ProjectAction[] = []
  if (status === ProjectStatus.draft) actions.push("confirm")
  if (status === ProjectStatus.confirmed) actions.push("markWaitingSample")
  if (status === ProjectStatus.waiting_delivery) actions.push("deliver")
  if (status === ProjectStatus.delivered) actions.push("complete")
  if (status === ProjectStatus.abnormal) actions.push("recover", "terminate")
  if (!isTerminalProjectStatus(status) && status !== ProjectStatus.abnormal) {
    actions.push("markAbnormal", "terminate")
  }
  return actions
}
