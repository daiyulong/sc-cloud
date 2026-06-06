import { describe, expect, it } from "vitest"
import {
  createSampleSchema,
  markSampleAbnormalSchema,
  receiveSampleSchema,
  updateSampleSchema,
} from "@/lib/schemas/sample"

const validCreateInput = {
  projectId: "p1",
  sampleNo: "YP-001",
  species: "人",
  tissueType: "肺组织",
  experimentType: "组织解离",
  transportCondition: "干冰",
}

describe("createSampleSchema", () => {
  it("parses a minimal valid sample", () => {
    const result = createSampleSchema.parse(validCreateInput)
    expect(result.sampleNo).toBe("YP-001")
    expect(result.sampleCount).toBeUndefined()
  })

  it("requires sampleNo and projectId", () => {
    expect(() => createSampleSchema.parse({ ...validCreateInput, sampleNo: " " })).toThrow()
    expect(() => createSampleSchema.parse({ ...validCreateInput, projectId: "" })).toThrow()
  })

  it("coerces sampleCount and rejects negatives (§8.3)", () => {
    expect(createSampleSchema.parse({ ...validCreateInput, sampleCount: "3" }).sampleCount).toBe(3)
    expect(
      createSampleSchema.parse({ ...validCreateInput, sampleCount: "" }).sampleCount
    ).toBeNull()
    expect(() => createSampleSchema.parse({ ...validCreateInput, sampleCount: "-1" })).toThrow()
    expect(() => createSampleSchema.parse({ ...validCreateInput, sampleCount: "1.5" })).toThrow()
  })

  it("rejects expected arrival earlier than sampling date, same day passes (§8.6)", () => {
    expect(() =>
      createSampleSchema.parse({
        ...validCreateInput,
        samplingDate: "2026-06-05",
        expectedArrivalDate: "2026-06-04",
      })
    ).toThrow()
    expect(() =>
      createSampleSchema.parse({
        ...validCreateInput,
        samplingDate: "2026-06-05",
        expectedArrivalDate: "2026-06-05",
      })
    ).not.toThrow()
    // 单边为空不参与比较
    expect(() =>
      createSampleSchema.parse({ ...validCreateInput, expectedArrivalDate: "2026-06-05" })
    ).not.toThrow()
  })
})

describe("updateSampleSchema", () => {
  it("requires at least one field", () => {
    expect(() => updateSampleSchema.parse({})).toThrow()
    expect(() => updateSampleSchema.parse({ species: "小鼠" })).not.toThrow()
  })

  it("does not accept projectId or status fields", () => {
    const result = updateSampleSchema.parse({ species: "小鼠", projectId: "p2", status: "received" })
    expect(result).toEqual({ species: "小鼠" })
  })
})

describe("receiveSampleSchema", () => {
  it("defaults to normal receive", () => {
    const result = receiveSampleSchema.parse({})
    expect(result.receiveStatus).toBe("normal")
  })

  it("requires abnormalNote when receive status is abnormal", () => {
    expect(() => receiveSampleSchema.parse({ receiveStatus: "abnormal" })).toThrow()
    expect(() =>
      receiveSampleSchema.parse({ receiveStatus: "abnormal", abnormalNote: "运输破损" })
    ).not.toThrow()
  })

  it("parses receivedAt datetime", () => {
    const result = receiveSampleSchema.parse({ receivedAt: "2026-06-07T10:30" })
    expect(result.receivedAt).toBeInstanceOf(Date)
  })
})

describe("markSampleAbnormalSchema", () => {
  it("requires a reason", () => {
    expect(() => markSampleAbnormalSchema.parse({ reason: "" })).toThrow()
    expect(() => markSampleAbnormalSchema.parse({ reason: "样本污染" })).not.toThrow()
  })
})
