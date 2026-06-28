import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { reportRunMetricsSchema, runMetricsItemSchema } from "@/lib/schemas/integration"
import { requireServiceToken } from "@/lib/integrations/auth"

describe("reportRunMetricsSchema", () => {
  const valid = { projectNo: "BP-G260505743", sampleName: "Ctrl_T_1", capturedCells: "10836" }

  it("接受批量条目，字符串转数字", () => {
    const parsed = reportRunMetricsSchema.parse({ items: [valid] })
    expect(parsed.items[0].capturedCells).toBe(10836)
    expect(parsed.items[0].projectNo).toBe("BP-G260505743")
  })

  it("projectNo / sampleName 必填", () => {
    expect(() => runMetricsItemSchema.parse({ sampleName: "x", capturedCells: 1 })).toThrow()
    expect(() => runMetricsItemSchema.parse({ projectNo: "x", capturedCells: 1 })).toThrow()
  })

  it("每条至少一项产出指标", () => {
    expect(() =>
      runMetricsItemSchema.parse({ projectNo: "p", sampleName: "s" })
    ).toThrow()
  })

  it("空 items 拒绝", () => {
    expect(() => reportRunMetricsSchema.parse({ items: [] })).toThrow()
  })

  it("捕获细胞数 / 基因中位数须整数、非负", () => {
    expect(() => runMetricsItemSchema.parse({ ...valid, capturedCells: "1.5" })).toThrow()
    expect(() => runMetricsItemSchema.parse({ projectNo: "p", sampleName: "s", medianGenes: "-1" })).toThrow()
  })
})

describe("requireServiceToken", () => {
  const ORIGINAL = process.env.INTEGRATION_API_KEY
  const KEY = "test-secret-token"

  beforeEach(() => {
    process.env.INTEGRATION_API_KEY = KEY
  })
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.INTEGRATION_API_KEY
    else process.env.INTEGRATION_API_KEY = ORIGINAL
  })

  const req = (headers: Record<string, string>) =>
    new Request("http://localhost/api/integrations/run-metrics", { method: "POST", headers })

  it("未配置 key → 503", () => {
    delete process.env.INTEGRATION_API_KEY
    expect(requireServiceToken(req({}))?.status).toBe(503)
  })

  it("缺令牌 → 401", () => {
    expect(requireServiceToken(req({}))?.status).toBe(401)
  })

  it("令牌不匹配 → 401", () => {
    expect(requireServiceToken(req({ authorization: "Bearer wrong" }))?.status).toBe(401)
  })

  it("Authorization: Bearer 正确 → 通过(null)", () => {
    expect(requireServiceToken(req({ authorization: `Bearer ${KEY}` }))).toBeNull()
  })

  it("X-Api-Key 正确 → 通过(null)", () => {
    expect(requireServiceToken(req({ "x-api-key": KEY }))).toBeNull()
  })
})
