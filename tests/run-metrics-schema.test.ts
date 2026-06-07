import { describe, expect, it } from "vitest"
import { recordRunMetricsSchema } from "@/lib/schemas/experiment-task"

describe("recordRunMetricsSchema", () => {
  it("空对象拒绝（至少一项产出指标）", () => {
    expect(() => recordRunMetricsSchema.parse({})).toThrow()
  })

  it("全空串拒绝（归一为 null 后仍视为空，不清掉全部指标）", () => {
    expect(() =>
      recordRunMetricsSchema.parse({
        suspensionType: "",
        sequencingAmount: "",
        capturedCells: "",
        medianGenes: "",
      })
    ).toThrow()
  })

  it("单项即通过，字符串转数字", () => {
    const parsed = recordRunMetricsSchema.parse({ capturedCells: "10836" })
    expect(parsed.capturedCells).toBe(10836)
    expect(parsed.sequencingAmount).toBeUndefined()
  })

  it("悬液类型枚举校验（细胞/细胞核）", () => {
    expect(recordRunMetricsSchema.parse({ suspensionType: "nucleus" }).suspensionType).toBe("nucleus")
    expect(() => recordRunMetricsSchema.parse({ suspensionType: "tcell" })).toThrow()
  })

  it("捕获细胞数 / 基因中位数必须整数", () => {
    expect(() => recordRunMetricsSchema.parse({ capturedCells: "1.5" })).toThrow()
    expect(() => recordRunMetricsSchema.parse({ medianGenes: "2.5" })).toThrow()
  })

  it("测序量允许小数、非负", () => {
    expect(recordRunMetricsSchema.parse({ sequencingAmount: "100.5" }).sequencingAmount).toBe(100.5)
    expect(() => recordRunMetricsSchema.parse({ sequencingAmount: "-1" })).toThrow()
  })
})
