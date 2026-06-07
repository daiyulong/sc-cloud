import { describe, expect, it } from "vitest"
import { ProjectStatus, SampleStatus, UserRole } from "@/lib/enums"
import {
  SampleDomainError,
  ensureProjectCanCreateSample,
  ensureProjectCanReceiveSample,
  ensureSampleRole,
  ensureSampleStatus,
  getAvailableSampleActions,
  sampleReceiveRoles,
} from "@/lib/samples/rules"

describe("sample rules", () => {
  it("exposes receive action for receiver roles on waiting samples", () => {
    expect(
      getAvailableSampleActions(SampleStatus.waiting_arrival, UserRole.sample_receiver)
    ).toEqual(["receive", "markAbnormal"])
    expect(
      getAvailableSampleActions(SampleStatus.waiting_arrival, UserRole.project_manager)
    ).toContain("receive")
    expect(getAvailableSampleActions(SampleStatus.waiting_arrival, UserRole.admin)).toContain(
      "receive"
    )
  })

  it("exposes only markAbnormal after receiving", () => {
    expect(
      getAvailableSampleActions(SampleStatus.received, UserRole.sample_receiver)
    ).toEqual(["markAbnormal"])
    expect(
      getAvailableSampleActions(SampleStatus.received_abnormal, UserRole.sample_receiver)
    ).toEqual(["markAbnormal"])
  })

  it("exposes no actions for non-receiver roles or downstream statuses", () => {
    expect(getAvailableSampleActions(SampleStatus.waiting_arrival, UserRole.sales_owner)).toEqual(
      []
    )
    expect(getAvailableSampleActions(SampleStatus.waiting_arrival, UserRole.lab_operator)).toEqual(
      []
    )
    expect(getAvailableSampleActions(SampleStatus.abnormal, UserRole.sample_receiver)).toEqual([])
    expect(
      getAvailableSampleActions(SampleStatus.feedback_submitted, UserRole.sample_receiver)
    ).toEqual([])
  })

  it("rejects roles outside the allowed list", () => {
    expect(() => ensureSampleRole(UserRole.sales_owner, sampleReceiveRoles, "接收样本")).toThrow(
      SampleDomainError
    )
    expect(() => ensureSampleRole(undefined, sampleReceiveRoles)).toThrow(SampleDomainError)
    expect(() =>
      ensureSampleRole(UserRole.sample_receiver, sampleReceiveRoles, "接收样本")
    ).not.toThrow()
  })

  it("rejects receive when sample is not waiting for arrival", () => {
    expect(() =>
      ensureSampleStatus(SampleStatus.received, [SampleStatus.waiting_arrival], "接收样本")
    ).toThrow(SampleDomainError)
  })

  it("allows receive only for receivable project statuses", () => {
    expect(() => ensureProjectCanReceiveSample(ProjectStatus.waiting_sample)).not.toThrow()
    expect(() => ensureProjectCanReceiveSample(ProjectStatus.sample_received)).not.toThrow()
    expect(() => ensureProjectCanReceiveSample(ProjectStatus.lab_in_progress)).not.toThrow()
    expect(() => ensureProjectCanReceiveSample(ProjectStatus.draft)).toThrow(
      SampleDomainError
    )
    expect(() => ensureProjectCanReceiveSample(ProjectStatus.abnormal)).toThrow(SampleDomainError)
    expect(() => ensureProjectCanReceiveSample(ProjectStatus.completed)).toThrow(
      SampleDomainError
    )
  })

  it("blocks sample creation on terminal or abnormal projects", () => {
    expect(() => ensureProjectCanCreateSample(ProjectStatus.draft)).not.toThrow()
    expect(() => ensureProjectCanCreateSample(ProjectStatus.waiting_sample)).not.toThrow()
    expect(() => ensureProjectCanCreateSample(ProjectStatus.completed)).toThrow(SampleDomainError)
    expect(() => ensureProjectCanCreateSample(ProjectStatus.terminated)).toThrow(
      SampleDomainError
    )
    expect(() => ensureProjectCanCreateSample(ProjectStatus.abnormal)).toThrow(SampleDomainError)
  })
})
