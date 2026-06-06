import {
  CalendarClock,
  ClipboardCheck,
  FlaskConical,
  PlayCircle,
  Send,
  type LucideIcon,
} from "lucide-react"
import type { ExperimentTaskStatus as ExperimentTaskStatusValue } from "@/lib/enums"
import {
  getAvailableExperimentTaskActions,
  type ExperimentTaskAction,
} from "@/lib/experiment-tasks/rules"

export type ExperimentTaskActionDescriptor = {
  action: ExperimentTaskAction
  label: string
  /** API 路径段：POST /api/experiment-tasks/[id]/<path> */
  path: string
  icon: LucideIcon
  /** direct=点击即执行；其余各自对应一个专用表单 Dialog */
  kind: "direct" | "scheduleDialog" | "feedbackDialog" | "qcDialog"
  description?: string
}

const descriptors: Record<ExperimentTaskAction, ExperimentTaskActionDescriptor> = {
  schedule: {
    action: "schedule",
    label: "设置排期",
    path: "schedule",
    icon: CalendarClock,
    kind: "scheduleDialog",
  },
  start: {
    action: "start",
    label: "开始实验",
    path: "start",
    icon: PlayCircle,
    kind: "direct",
  },
  finish: {
    action: "finish",
    label: "完成实验（待反馈）",
    path: "finish",
    icon: FlaskConical,
    kind: "direct",
    description: "标记实验台操作完成、等待结果反馈。",
  },
  feedback: {
    action: "feedback",
    label: "提交实验反馈",
    path: "feedback",
    icon: Send,
    kind: "feedbackDialog",
  },
  qc: {
    action: "qc",
    label: "录入质控",
    path: "qc",
    icon: ClipboardCheck,
    kind: "qcDialog",
  },
}

/** 主动作 = 推进工作流的首个动作；完成实验(待反馈) / 录入质控 进溢出菜单 */
export function partitionExperimentTaskActions(
  status: ExperimentTaskStatusValue,
  role?: string
): { primary?: ExperimentTaskActionDescriptor; overflow: ExperimentTaskActionDescriptor[] } {
  const available = getAvailableExperimentTaskActions(status, role).map(
    (action) => descriptors[action]
  )
  const [primary, ...overflow] = available
  return { primary, overflow }
}
