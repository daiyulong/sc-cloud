import {
  AlertTriangle,
  Check,
  PackageCheck,
  RotateCcw,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import type { ProjectStatus as ProjectStatusValue } from "@/lib/enums"
import { getAvailableProjectActions, type ProjectAction } from "@/lib/projects/rules"

export type ProjectActionDescriptor = {
  action: ProjectAction
  label: string
  /** API 路径段：POST /api/projects/[id]/<path> */
  path: string
  icon: LucideIcon
  /** direct=点击即执行；confirmDialog=轻确认；confirmForm=确认并填项目编号；reasonDialog=带原因输入 */
  kind: "direct" | "confirmDialog" | "confirmForm" | "reasonDialog"
  destructive?: boolean
  /** reasonDialog：原因是否必填（与对应 zod schema 对齐） */
  reasonRequired?: boolean
  reasonLabel?: string
  /** Dialog 内的补充说明 */
  description?: string
}

const descriptors: Record<ProjectAction, ProjectActionDescriptor> = {
  confirm: { action: "confirm", label: "确认项目", path: "confirm", icon: Check, kind: "confirmForm" },
  deliver: {
    action: "deliver",
    label: "确认交付",
    path: "deliver",
    icon: PackageCheck,
    kind: "confirmDialog",
    description: "确认交付后项目进入已完成终态，并级联交付项目下待交付的生信任务。",
  },
  recover: {
    action: "recover",
    label: "恢复异常",
    path: "recover",
    icon: RotateCcw,
    kind: "reasonDialog",
    reasonRequired: false,
    reasonLabel: "处理说明",
    description: "恢复到异常前的状态。",
  },
  // reason 必填与 projectReasonSchema 对齐（旧 UI 当可选传空串会被 400 拒，此处修正）
  markAbnormal: {
    action: "markAbnormal",
    label: "标记异常",
    path: "mark-abnormal",
    icon: AlertTriangle,
    kind: "reasonDialog",
    destructive: true,
    reasonRequired: true,
    reasonLabel: "异常原因",
  },
  terminate: {
    action: "terminate",
    label: "异常终止",
    path: "terminate",
    icon: XCircle,
    kind: "reasonDialog",
    destructive: true,
    reasonRequired: false,
    reasonLabel: "终止原因",
    description: "终止后项目进入终态，不可恢复。",
  },
}

/** 主动作 = 首个非破坏性动作；破坏性动作永远进溢出菜单 */
export function partitionProjectActions(
  status: ProjectStatusValue,
  role?: string
): { primary?: ProjectActionDescriptor; overflow: ProjectActionDescriptor[] } {
  const available = getAvailableProjectActions(status, role).map((action) => descriptors[action])
  const primary = available.find((descriptor) => !descriptor.destructive)
  const overflow = available.filter((descriptor) => descriptor !== primary)
  return { primary, overflow }
}
