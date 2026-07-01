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
  /** workItem=进入工作项主任务；inlineSection=在工作项分区内处理 */
  kind: "workItem" | "inlineSection"
  description?: string
}

const descriptors: Record<ExperimentTaskAction, ExperimentTaskActionDescriptor> = {
  schedule: {
    action: "schedule",
    label: "设置排期",
    path: "schedule",
    icon: CalendarClock,
    kind: "workItem",
  },
  start: {
    action: "start",
    label: "开始实验",
    path: "start",
    icon: PlayCircle,
    kind: "workItem",
  },
  finish: {
    action: "finish",
    label: "完成实验（待提交结果）",
    path: "finish",
    icon: FlaskConical,
    kind: "workItem",
    description: "标记实验台操作完成、等待提交结果。",
  },
  feedback: {
    action: "feedback",
    label: "提交实验结果",
    path: "feedback",
    icon: Send,
    kind: "workItem",
  },
  qc: {
    action: "qc",
    label: "录入质控",
    path: "qc",
    icon: ClipboardCheck,
    kind: "inlineSection",
  },
}

/** 主动作 = 推进工作流的首个动作；补充动作在 WorkItemPanel 内分区处理 */
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
