import { describe, expect, it } from "vitest"
import { ProjectStatus, SampleBatchStatus, UserRole } from "@/lib/enums"
import {
  SampleDomainError,
  ensureProjectCanCreateSample,
  ensureProjectCanReceiveSample,
  ensureSampleRole,
  ensureSampleStatus,
  getAvailableSampleActions,
  sampleReceiveRoles,
} from "@/lib/samples/rules"

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

  it("exposes no actions for non-receiver roles", () => {
    expect(
      getAvailableSampleActions(SampleBatchStatus.waiting_arrival, UserRole.sales_owner)
    ).toEqual([])
    expect(
      getAvailableSampleActions(SampleBatchStatus.waiting_arrival, UserRole.lab_operator)
    ).toEqual([])
  })

  it("rejects roles outside the allowed list", () => {
    expect(() => ensureSampleRole(UserRole.sales_owner, sampleReceiveRoles, "登记接收")).toThrow(
      SampleDomainError
    )
    expect(() => ensureSampleRole(undefined, sampleReceiveRoles)).toThrow(SampleDomainError)
    expect(() =>
      ensureSampleRole(UserRole.sample_receiver, sampleReceiveRoles, "登记接收")
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

  it("blocks batch creation on terminal or abnormal projects", () => {
    expect(() => ensureProjectCanCreateSample(ProjectStatus.draft)).not.toThrow()
    expect(() => ensureProjectCanCreateSample(ProjectStatus.waiting_sample)).not.toThrow()
    expect(() => ensureProjectCanCreateSample(ProjectStatus.completed)).toThrow(SampleDomainError)
    expect(() => ensureProjectCanCreateSample(ProjectStatus.terminated)).toThrow(SampleDomainError)
    expect(() => ensureProjectCanCreateSample(ProjectStatus.abnormal)).toThrow(SampleDomainError)
  })
})
