import { describe, expect, it } from "vitest"
import { ProjectStatus, SampleBatchStatus, UserRole } from "@/lib/enums"
import {
  SampleDomainError,
  ensureProjectCanReceiveSample,
  ensureSampleRole,
  ensureSampleStatus,
  getAvailableSampleActions,
} from "@/lib/samples/rules"
import { staffRoles } from "@/lib/auth/action-roles"

// 2026-06 重构：「样本」域动作作用于样本批次（SampleBatch）。
describe("sample batch rules", () => {
  it("exposes receive action for receiver roles on waiting batches", () => {
    expect(
      getAvailableSampleActions(SampleBatchStatus.waiting_arrival, UserRole.sample_receiver)
    ).toEqual(["receive", "markAbnormal"])
    expect(
      getAvailableSampleActions(SampleBatchStatus.waiting_arrival, UserRole.project_manager)
    ).toContain("receive")
    expect(getAvailableSampleActions(SampleBatchStatus.waiting_arrival, UserRole.admin)).toContain(
      "receive"
    )
  })

  it("exposes only markAbnormal after receiving; none once abnormal", () => {
    expect(
      getAvailableSampleActions(SampleBatchStatus.received, UserRole.sample_receiver)
    ).toEqual(["markAbnormal"])
    expect(
      getAvailableSampleActions(SampleBatchStatus.received_abnormal, UserRole.sample_receiver)
    ).toEqual([])
  })

  it("仅 viewer / 空角色无动作；其余在岗角色可替班登记接收（开放协作）", () => {
    expect(getAvailableSampleActions(SampleBatchStatus.waiting_arrival, UserRole.viewer)).toEqual([])
    expect(getAvailableSampleActions(SampleBatchStatus.waiting_arrival, undefined)).toEqual([])
    for (const role of [UserRole.sales_owner, UserRole.lab_operator]) {
      expect(
        getAvailableSampleActions(SampleBatchStatus.waiting_arrival, role)
      ).toContain("receive")
    }
  })

  it("ensureSampleRole：viewer / 空角色被拒，在岗角色（含销售）放行", () => {
    expect(() => ensureSampleRole(UserRole.viewer, staffRoles, "登记接收")).toThrow(
      SampleDomainError
    )
    expect(() => ensureSampleRole(undefined, staffRoles)).toThrow(SampleDomainError)
    expect(() =>
      ensureSampleRole(UserRole.sales_owner, staffRoles, "登记接收")
    ).not.toThrow()
    expect(() =>
      ensureSampleRole(UserRole.sample_receiver, staffRoles, "登记接收")
    ).not.toThrow()
  })

  it("rejects receive when batch is not waiting for arrival", () => {
    expect(() =>
      ensureSampleStatus(
        SampleBatchStatus.received,
        [SampleBatchStatus.waiting_arrival],
        "登记接收"
      )
    ).toThrow(SampleDomainError)
  })

  it("allows receive only for receivable project statuses", () => {
    expect(() => ensureProjectCanReceiveSample(ProjectStatus.waiting_sample)).not.toThrow()
    expect(() => ensureProjectCanReceiveSample(ProjectStatus.sample_received)).not.toThrow()
    expect(() => ensureProjectCanReceiveSample(ProjectStatus.lab_in_progress)).not.toThrow()
    expect(() => ensureProjectCanReceiveSample(ProjectStatus.draft)).toThrow(SampleDomainError)
    expect(() => ensureProjectCanReceiveSample(ProjectStatus.abnormal)).toThrow(SampleDomainError)
    expect(() => ensureProjectCanReceiveSample(ProjectStatus.completed)).toThrow(SampleDomainError)
  })

  it("项目草稿时不暴露 receive 动作", () => {
    expect(
      getAvailableSampleActions(
        SampleBatchStatus.waiting_arrival,
        UserRole.sample_receiver,
        ProjectStatus.draft
      )
    ).toEqual(["markAbnormal"])
    expect(
      getAvailableSampleActions(
        SampleBatchStatus.waiting_arrival,
        UserRole.sample_receiver,
        ProjectStatus.waiting_sample
      )
    ).toContain("receive")
  })
})
