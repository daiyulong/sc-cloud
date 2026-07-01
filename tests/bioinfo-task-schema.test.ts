import { describe, expect, it } from "vitest"
import {
  bioinfoTaskListQuerySchema,
  createBioinfoTaskSchema,
  startBioinfoTaskSchema,
  submitBioinfoTaskSchema,
  updateBioinfoTaskSchema,
} from "@/lib/schemas/bioinfo-task"

describe("createBioinfoTaskSchema", () => {
  it("空字段落 null（全可选，关联实验任务由路径提供）", () => {
    const parsed = createBioinfoTaskSchema.parse({ analysisType: "", analystId: "  " })
    expect(parsed.analysisType).toBeNull()
    expect(parsed.analystId).toBeNull()
  })

  it("接受日期字符串", () => {
    const parsed = createBioinfoTaskSchema.parse({ dataReceivedAt: "2026-06-10" })
    expect(parsed.dataReceivedAt).toBeInstanceOf(Date)
  })
})

describe("startBioinfoTaskSchema", () => {
  it("analystId 空串落 null，dataReceivedAt 可空", () => {
    const parsed = startBioinfoTaskSchema.parse({ analystId: "", dataReceivedAt: "" })
    expect(parsed.analystId).toBeNull()
    expect(parsed.dataReceivedAt).toBeNull()
  })
})

describe("submitBioinfoTaskSchema", () => {
  it("交付物说明可空、可填", () => {
    expect(submitBioinfoTaskSchema.parse({}).deliverableNote).toBeUndefined()
    const parsed = submitBioinfoTaskSchema.parse({ deliverableNote: "报告+矩阵文件" })
    expect(parsed.deliverableNote).toBe("报告+矩阵文件")
  })
})

describe("updateBioinfoTaskSchema", () => {
  it("空对象拒绝（至少一个字段）", () => {
    expect(() => updateBioinfoTaskSchema.parse({})).toThrow()
  })

  it("单字段更新通过", () => {
    expect(updateBioinfoTaskSchema.parse({ analysisType: "高级分析" }).analysisType).toBe("高级分析")
  })
})

describe("bioinfoTaskListQuerySchema", () => {
  it("open 仅接受 '1'", () => {
    expect(bioinfoTaskListQuerySchema.parse({ open: "1" }).open).toBe("1")
    expect(() => bioinfoTaskListQuerySchema.parse({ open: "yes" })).toThrow()
  })

  it("空查询通过", () => {
    expect(bioinfoTaskListQuerySchema.parse({})).toEqual({})
  })
})
