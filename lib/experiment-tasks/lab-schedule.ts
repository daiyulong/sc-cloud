import { toDateOnly, toDateString } from "@/lib/utils"

export type ExperimentScheduleTask = {
  id: string
  taskNo: string
  projectNo: string
  customerOrg: string
  experimentType: string
  status: string
  plannedDate: string
  operatorName: string | null
  sampleNames: string[]
}

export type ExperimentScheduleAppointmentBatch = {
  id: string
  batchNo: string | null
  projectId: string
  projectNo: string
  customerOrg: string
  experimentType: string | null
  receivedAt: string | null
  sampleCount: number
}

export function countScheduleTasksByDate(tasks: ExperimentScheduleTask[]) {
  const counts = new Map<string, number>()
  for (const task of tasks) {
    if (!task.plannedDate) continue
    counts.set(task.plannedDate, (counts.get(task.plannedDate) ?? 0) + 1)
  }
  return counts
}

export function scheduleLoadLevel(count: number) {
  if (count <= 0) return "idle"
  if (count >= 6) return "full"
  if (count >= 4) return "busy"
  return "normal"
}

export function scheduleLoadLabel(count: number) {
  if (count <= 0) return "空闲"
  if (count >= 6) return "高负载"
  if (count >= 4) return "较忙"
  return "可预约"
}

export function buildScheduleWindow(anchorDate: Date | string | null | undefined, days = 14) {
  const start = toDateOnly(anchorDate) ?? toDateOnly(new Date())
  if (!start) return []

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return toDateString(date)
  })
}
