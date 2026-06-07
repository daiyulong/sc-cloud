import { describe, expect, it } from "vitest"
import { canRecordQc, getAvailableExperimentTaskActions } from "@/lib/experiment-tasks/rules"
import { ExperimentTaskStatus, UserRole } from "@/lib/enums"

describe("getAvailableExperimentTaskActions", () => {
  it("待排期 + 实验员：仅设置排期", () => {
    expect(
      getAvailableExperimentTaskActions(ExperimentTaskStatus.waiting_schedule, UserRole.lab_operator)
    ).toEqual(["schedule"])
  })

  it("已排期 + 实验员：仅开始实验", () => {
    expect(
      getAvailableExperimentTaskActions(ExperimentTaskStatus.scheduled, UserRole.lab_operator)
    ).toEqual(["start"])
  })

  it("进行中：提交反馈（主）+ 完成实验 + 录入质控", () => {
    expect(
      getAvailableExperimentTaskActions(ExperimentTaskStatus.in_progress, UserRole.lab_operator)
    ).toEqual(["feedback", "finish", "qc"])
  })

  it("待反馈：提交反馈（主）+ 录入质控（无完成实验）", () => {
    expect(
      getAvailableExperimentTaskActions(ExperimentTaskStatus.waiting_feedback, UserRole.lab_operator)
    ).toEqual(["feedback", "qc"])
  })

  it("终态（已完成/已取消/异常）：无任何动作", () => {
    for (const status of [
      ExperimentTaskStatus.completed,
      ExperimentTaskStatus.cancelled,
      ExperimentTaskStatus.abnormal,
    ]) {
      expect(getAvailableExperimentTaskActions(status, UserRole.lab_operator)).toEqual([])
    }
  })

  it("管理员 / 项目经理同样可执行；销售 / 接收员 / 生信 / 查看者无权", () => {
    for (const role of [UserRole.admin, UserRole.project_manager]) {
      expect(
        getAvailableExperimentTaskActions(ExperimentTaskStatus.waiting_schedule, role)
      ).toEqual(["schedule"])
    }
    for (const role of [
      UserRole.sales_owner,
      UserRole.sample_receiver,
      UserRole.bioinfo_analyst,
      UserRole.viewer,
      undefined,
    ]) {
      expect(
        getAvailableExperimentTaskActions(ExperimentTaskStatus.in_progress, role)
      ).toEqual([])
    }
  })
})

describe("canRecordQc（含 completed 补录）", () => {
  it("进行中/待反馈/已完成 + 管理角色可录（已完成为补录）", () => {
    for (const status of [
      ExperimentTaskStatus.in_progress,
      ExperimentTaskStatus.waiting_feedback,
      ExperimentTaskStatus.completed,
    ]) {
      expect(canRecordQc(status, UserRole.lab_operator)).toBe(true)
    }
  })

  it("未开始/取消/异常不可录", () => {
    for (const status of [
      ExperimentTaskStatus.waiting_schedule,
      ExperimentTaskStatus.scheduled,
      ExperimentTaskStatus.cancelled,
      ExperimentTaskStatus.abnormal,
    ]) {
      expect(canRecordQc(status, UserRole.lab_operator)).toBe(false)
    }
  })

  it("无关角色/空角色不可录", () => {
    expect(canRecordQc(ExperimentTaskStatus.completed, UserRole.viewer)).toBe(false)
    expect(canRecordQc(ExperimentTaskStatus.completed, undefined)).toBe(false)
  })
})
