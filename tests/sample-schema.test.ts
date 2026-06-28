import { describe, expect, it } from "vitest"
import {
  createSampleSchema,
  markSampleAbnormalSchema,
  receiveSampleSchema,
  updateSampleSchema,
} from "@/lib/schemas/sample"

// 2026-06 重构：「样本」schema 操作的是样本批次（SampleBatch）；批次字段进度式收集、多为可空。
const validCreateInput = {
  projectId: "p1",
  batchNo: "YP-001",
  species: "人",
  tissueType: "肺组织",
  experimentType: "组织解离",
  transportCondition: "干冰",
}

describe("createSampleSchema (batch)", () => {
  it("parses a minimal valid batch (only projectId required)", () => {
    const result = createSampleSchema.parse({ projectId: "p1" })
    expect(result.projectId).toBe("p1")
    expect(result.sampleCount).toBeUndefined()
  })

  it("keeps batchNo when provided", () => {
    expect(createSampleSchema.parse(validCreateInput).batchNo).toBe("YP-001")
  })

  it("requires projectId", () => {
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
    expect(() =>
      createSampleSchema.parse({ ...validCreateInput, expectedArrivalDate: "2026-06-05" })
    ).not.toThrow()
  })
})

describe("updateSampleSchema (batch)", () => {
  it("requires at least one field", () => {
    expect(() => updateSampleSchema.parse({})).toThrow()
    expect(() => updateSampleSchema.parse({ species: "小鼠" })).not.toThrow()
  })

  it("does not accept projectId or status fields", () => {
    const result = updateSampleSchema.parse({ species: "小鼠", projectId: "p2", status: "received" })
    expect(result).toEqual({ species: "小鼠" })
  })
})

describe("receiveSampleSchema (batch)", () => {
  // 登记接收：数量必填 ≥1（据此生成样本叶子）；批次信息字段可空、收样时补
  const info = { sampleCount: 2, species: "人", tissueType: "肺", transportCondition: "干冰" }

  it("requires sampleCount >= 1", () => {
    expect(() => receiveSampleSchema.parse({})).toThrow()
    expect(() => receiveSampleSchema.parse({ sampleCount: 0 })).toThrow()
    expect(() => receiveSampleSchema.parse({ sampleCount: 2 })).not.toThrow()
  })

  it("defaults to normal receive", () => {
    const result = receiveSampleSchema.parse({ ...info })
    expect(result.receiveStatus).toBe("normal")
    expect(result.sampleCount).toBe(2)
  })

  it("requires abnormalNote when receive status is abnormal", () => {
    expect(() => receiveSampleSchema.parse({ ...info, receiveStatus: "abnormal" })).toThrow()
    expect(() =>
      receiveSampleSchema.parse({ ...info, receiveStatus: "abnormal", abnormalNote: "运输破损" })
    ).not.toThrow()
  })

  it("parses receivedAt datetime", () => {
    const result = receiveSampleSchema.parse({ ...info, receivedAt: "2026-06-07T10:30" })
    expect(result.receivedAt).toBeInstanceOf(Date)
  })
})

describe("markSampleAbnormalSchema", () => {
  it("requires a reason", () => {
    expect(() => markSampleAbnormalSchema.parse({ reason: "" })).toThrow()
    expect(() => markSampleAbnormalSchema.parse({ reason: "样本污染" })).not.toThrow()
  })
})
