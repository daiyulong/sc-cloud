import { ClipboardList, PlayCircle, Send, type LucideIcon } from "lucide-react"
import type { BioinfoTaskStatus as BioinfoTaskStatusValue } from "@/lib/enums"
import {
  getAvailableBioinfoTaskActions,
  type BioinfoTaskAction,
} from "@/lib/bioinfo-tasks/rules"

export type BioinfoTaskActionDescriptor = {
  action: BioinfoTaskAction
  label: string
  /** API 路径段：POST /api/bioinfo-tasks/[id]/<path> */
  path: string
  icon: LucideIcon
  /** direct=点击即执行；submitDialog=提交报告表单 */
  kind: "direct" | "submitDialog"
  description?: string
}

const descriptors: Record<BioinfoTaskAction, BioinfoTaskActionDescriptor> = {
  start: {
    action: "start",
    label: "开始分析",
    path: "start",
    icon: PlayCircle,
    kind: "direct",
  },
  review: {
    action: "review",
    label: "提交审核",
    path: "review",
    icon: ClipboardList,
    kind: "direct",
    description: "标记分析完成、自检报告，进入待审核。",
  },
  submit: {
    action: "submit",
    label: "提交报告",
    path: "submit",
    icon: Send,
    kind: "submitDialog",
  },
}

/** 主动作 = 推进工作流的首个动作；提交审核进溢出菜单 */
export function partitionBioinfoTaskActions(
  status: BioinfoTaskStatusValue,
  role?: string
): { primary?: BioinfoTaskActionDescriptor; overflow: BioinfoTaskActionDescriptor[] } {
  const available = getAvailableBioinfoTaskActions(status, role).map((action) => descriptors[action])
  const [primary, ...overflow] = available
  return { primary, overflow }
}
