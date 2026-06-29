import { describe, expect, it } from "vitest"
import { canRecordRunMetrics } from "@/lib/experiment-tasks/rules"
import { ExperimentTaskStatus, UserRole } from "@/lib/enums"

describe("canRecordRunMetrics", () => {
  it("已完成 + 录入角色（生信/实验/项目经理/管理员）可录", () => {
    for (const role of [
      UserRole.bioinfo_analyst,
      UserRole.lab_operator,
      UserRole.project_manager,
      UserRole.admin,
    ]) {
      expect(canRecordRunMetrics(ExperimentTaskStatus.completed, role)).toBe(true)
    }
  })

  it("非已完成状态不可录（指标须下机定量后才有）", () => {
    for (const status of [
      ExperimentTaskStatus.scheduled,
      ExperimentTaskStatus.in_progress,
      ExperimentTaskStatus.waiting_feedback,
    ]) {
      expect(canRecordRunMetrics(status, UserRole.bioinfo_analyst)).toBe(false)
    }
  })

  it("viewer / 空角色不可录；其余在岗角色（含接收员）可录（开放协作）", () => {
    expect(canRecordRunMetrics(ExperimentTaskStatus.completed, UserRole.viewer)).toBe(false)
    expect(canRecordRunMetrics(ExperimentTaskStatus.completed, undefined)).toBe(false)
    expect(canRecordRunMetrics(ExperimentTaskStatus.completed, UserRole.sample_receiver)).toBe(true)
  })
})
