import {
  ExperimentTaskStatus,
  type ExperimentTaskStatus as ExperimentTaskStatusValue,
} from "@/lib/enums"
import { experimentManageRoles } from "@/lib/experiment-tasks/rules"

// 上机后（进行中/待反馈/已完成）方可上传实验记录；与后端 UPLOADABLE_STATUSES 同源。
export const RECORD_UPLOADABLE_STATUSES: ExperimentTaskStatusValue[] = [
  ExperimentTaskStatus.in_progress,
  ExperimentTaskStatus.waiting_feedback,
  ExperimentTaskStatus.completed,
]

export function canUploadRecord(status: string, role?: string): boolean {
  return (
    RECORD_UPLOADABLE_STATUSES.includes(status as ExperimentTaskStatusValue) &&
    !!role &&
    experimentManageRoles.includes(role as (typeof experimentManageRoles)[number])
  )
}
