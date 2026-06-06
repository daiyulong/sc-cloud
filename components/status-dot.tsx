import { cn } from "@/lib/utils"
import type { ExperimentTaskStatus, ProjectStatus, SampleStatus } from "@/lib/enums"

/**
 * 状态彩点（Vercel 式「● Ready」）。色彩语义：
 * 灰=未启动/终止，琥珀=等待，蓝/橙/紫=进行中，绿=完成，红=异常。
 */
export const PROJECT_STATUS_DOT: Record<ProjectStatus, string> = {
  draft: "bg-zinc-400",
  confirmed: "bg-sky-500",
  waiting_sample: "bg-amber-400",
  sample_received: "bg-teal-500",
  lab_in_progress: "bg-orange-500",
  waiting_bioinfo: "bg-amber-400",
  bioinfo_in_progress: "bg-violet-500",
  waiting_delivery: "bg-amber-400",
  delivered: "bg-emerald-500",
  completed: "bg-emerald-500",
  abnormal: "bg-red-500",
  terminated: "bg-zinc-400",
}

export const SAMPLE_STATUS_DOT: Record<SampleStatus, string> = {
  waiting_arrival: "bg-amber-400",
  received: "bg-teal-500",
  received_abnormal: "bg-orange-500",
  waiting_task: "bg-amber-400",
  lab_in_progress: "bg-orange-500",
  feedback_submitted: "bg-emerald-500",
  abnormal: "bg-red-500",
}

export const EXPERIMENT_TASK_STATUS_DOT: Record<ExperimentTaskStatus, string> = {
  waiting_schedule: "bg-amber-400",
  scheduled: "bg-sky-500",
  in_progress: "bg-orange-500",
  waiting_feedback: "bg-amber-400",
  completed: "bg-emerald-500",
  cancelled: "bg-zinc-400",
  abnormal: "bg-red-500",
}

export function StatusDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2 shrink-0 rounded-full align-middle", className)}
    />
  )
}
