import { describe, expect, it } from "vitest"
import { partitionSampleActions } from "@/components/samples/sample-action-config"
import { SampleBatchStatus, UserRole } from "@/lib/enums"

describe("partitionSampleActions", () => {
  it("waiting_arrival + 接收员：主动作 receive（表单 Dialog），溢出 markAbnormal", () => {
    const { primary, overflow } = partitionSampleActions(
      SampleBatchStatus.waiting_arrival,
      UserRole.sample_receiver
    )
    expect(primary?.action).toBe("receive")
    expect(primary?.kind).toBe("formDialog")
    expect(overflow.map((d) => d.action)).toEqual(["markAbnormal"])
    expect(overflow[0].destructive).toBe(true)
    expect(overflow[0].reasonRequired).toBe(true)
  })

  it("received：仅溢出 markAbnormal，无主动作", () => {
    const { primary, overflow } = partitionSampleActions(
      SampleBatchStatus.received,
      UserRole.sample_receiver
    )
    expect(primary).toBeUndefined()
    expect(overflow.map((d) => d.action)).toEqual(["markAbnormal"])
  })

  it("仅 viewer 两侧都为空；销售/实验员等在岗角色可替班登记接收（开放协作）", () => {
    const blocked = partitionSampleActions(SampleBatchStatus.waiting_arrival, UserRole.viewer)
    expect(blocked.primary).toBeUndefined()
    expect(blocked.overflow).toEqual([])

    for (const role of [UserRole.sales_owner, UserRole.lab_operator]) {
      const { primary, overflow } = partitionSampleActions(SampleBatchStatus.waiting_arrival, role)
      expect(primary?.action).toBe("receive")
      expect(overflow.map((d) => d.action)).toEqual(["markAbnormal"])
    }
  })

  it("received_abnormal（已异常）：无任何动作", () => {
    const { primary, overflow } = partitionSampleActions(
      SampleBatchStatus.received_abnormal,
      UserRole.sample_receiver
    )
    expect(primary).toBeUndefined()
    expect(overflow).toEqual([])
  })
})
