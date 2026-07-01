import { AlertTriangle, PackageCheck, type LucideIcon } from "lucide-react"
import type {
  ProjectStatus as ProjectStatusValue,
  SampleBatchStatus as SampleBatchStatusValue,
} from "@/lib/enums"
import { getAvailableSampleActions, type SampleAction } from "@/lib/samples/rules"

export type SampleActionDescriptor = {
  action: SampleAction
  label: string
  /** API 路径段：POST /api/samples/[id]/<path> */
  path: string
  icon: LucideIcon
  /** workItem=打开工作项面板处理；reasonDialog=带原因输入 */
  kind: "workItem" | "reasonDialog"
  destructive?: boolean
  reasonRequired?: boolean
  reasonLabel?: string
  description?: string
}

const descriptors: Record<SampleAction, SampleActionDescriptor> = {
  receive: {
    action: "receive",
    label: "登记接收",
    path: "receive",
    icon: PackageCheck,
    kind: "workItem",
  },
  markAbnormal: {
    action: "markAbnormal",
    label: "登记样本异常",
    path: "mark-abnormal",
    icon: AlertTriangle,
    kind: "reasonDialog",
    destructive: true,
    reasonRequired: true,
    reasonLabel: "异常原因",
    description: "只标记样本异常，不影响项目状态。",
  },
}

/** 主动作 = 首个非破坏性动作；破坏性动作永远进溢出菜单 */
export function partitionSampleActions(
  status: SampleBatchStatusValue,
  role?: string,
  projectStatus?: ProjectStatusValue
): { primary?: SampleActionDescriptor; overflow: SampleActionDescriptor[] } {
  const available = getAvailableSampleActions(status, role, projectStatus).map(
    (action) => descriptors[action]
  )
  const primary = available.find((descriptor) => !descriptor.destructive)
  const overflow = available.filter((descriptor) => descriptor !== primary)
  return { primary, overflow }
}
