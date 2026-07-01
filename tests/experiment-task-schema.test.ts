import { describe, expect, it } from "vitest"
import {
  createExperimentTaskSchema,
  createExperimentTaskWithSamplesSchema,
  experimentTaskListQuerySchema,
  recordQcSchema,
  scheduleTaskSchema,
  submitFeedbackSchema,
  updateExperimentTaskSchema,
} from "@/lib/schemas/experiment-task"
import { QCResult, ResultStatus, RiskLevel } from "@/lib/enums"

describe("createExperimentTaskSchema", () => {
  it("实验类型必填，空 runMethod/department 落 null", () => {
    const parsed = createExperimentTaskSchema.parse({
      experimentType: "组织解离",
      runMethod: "",
      department: "  ",
    })
    expect(parsed.experimentType).toBe("组织解离")
    expect(parsed.runMethod).toBeNull()
    expect(parsed.department).toBeNull()
  })

  it("缺实验类型拒绝", () => {
    expect(() => createExperimentTaskSchema.parse({})).toThrow()
  })
})

describe("scheduleTaskSchema", () => {
  it("计划日期必填（空串拒绝）", () => {
    expect(() => scheduleTaskSchema.parse({ plannedDate: "" })).toThrow()
  })

  it("接受日期字符串，operatorId 空串落 null", () => {
    const parsed = scheduleTaskSchema.parse({ plannedDate: "2026-06-10", operatorId: "" })
    expect(parsed.plannedDate).toBeInstanceOf(Date)
    expect(parsed.operatorId).toBeNull()
  })
})

describe("submitFeedbackSchema", () => {
  it("结果状态 + 结果反馈必填", () => {
    expect(() => submitFeedbackSchema.parse({ resultStatus: ResultStatus.normal_run })).toThrow()
    expect(() =>
      submitFeedbackSchema.parse({ resultStatus: "bogus", resultFeedback: "ok" })
    ).toThrow()
    const parsed = submitFeedbackSchema.parse({
      resultStatus: ResultStatus.normal_run,
      resultFeedback: "正常上机，捕获良好",
      bioinfoAnalystId: "  ",
    })
    expect(parsed.resultStatus).toBe("normal_run")
    expect(parsed.bioinfoAnalystId).toBeNull()
  })
})

describe("recordQcSchema", () => {
  it("结论 + 风险等级必填；活率/结团率 0-100；空值落 null", () => {
    const parsed = recordQcSchema.parse({
      qcResult: QCResult.passed,
      riskLevel: RiskLevel.normal,
      concentration: "",
      viability: "92.5",
      aggregationRate: "",
    })
    expect(parsed.concentration).toBeNull()
    expect(parsed.viability).toBe(92.5)
    expect(parsed.aggregationRate).toBeNull()
  })

  it("活率超出 0-100 拒绝", () => {
    expect(() =>
      recordQcSchema.parse({ qcResult: QCResult.passed, riskLevel: RiskLevel.normal, viability: 120 })
    ).toThrow()
    expect(() =>
      recordQcSchema.parse({ qcResult: QCResult.passed, riskLevel: RiskLevel.normal, aggregationRate: -1 })
    ).toThrow()
  })

  it("缺结论拒绝", () => {
    expect(() => recordQcSchema.parse({ riskLevel: RiskLevel.normal })).toThrow()
  })
})

describe("updateExperimentTaskSchema", () => {
  it("空对象拒绝（至少一个字段）", () => {
    expect(() => updateExperimentTaskSchema.parse({})).toThrow()
  })

  it("单字段更新通过（runMethod）", () => {
    expect(updateExperimentTaskSchema.parse({ runMethod: "GEM-X" }).runMethod).toBe("GEM-X")
  })
})

describe("experimentTaskListQuerySchema", () => {
  it("date 仅接受 today", () => {
    expect(experimentTaskListQuerySchema.parse({ date: "today" }).date).toBe("today")
    expect(() => experimentTaskListQuerySchema.parse({ date: "tomorrow" })).toThrow()
  })

  it("plannedDate 接受合法自然日并拒绝非法日期", () => {
    expect(experimentTaskListQuerySchema.parse({ plannedDate: "2026-07-01" }).plannedDate).toBe(
      "2026-07-01"
    )
    expect(() => experimentTaskListQuerySchema.parse({ plannedDate: "2026-7-1" })).toThrow()
    expect(() => experimentTaskListQuerySchema.parse({ plannedDate: "2026-02-30" })).toThrow()
  })

  it("mode=schedule 标志位", () => {
    expect(experimentTaskListQuerySchema.parse({ mode: "schedule" }).mode).toBe("schedule")
    expect(() => experimentTaskListQuerySchema.parse({ mode: "list" })).toThrow()
  })

  it("空查询通过", () => {
    expect(experimentTaskListQuerySchema.parse({})).toEqual({})
  })
})

describe("createExperimentTaskWithSamplesSchema", () => {
  it("合法 sampleIds[3] 通过", () => {
    const parsed = createExperimentTaskWithSamplesSchema.parse({
      experimentType: "建库",
      sampleIds: ["s1", "s2", "s3"],
    })
    expect(parsed.sampleIds).toEqual(["s1", "s2", "s3"])
    expect(parsed.experimentType).toBe("建库")
  })

  it("空数组拒绝（min 1）", () => {
    expect(() =>
      createExperimentTaskWithSamplesSchema.parse({
        experimentType: "建库",
        sampleIds: [],
      })
    ).toThrow()
  })

  it("> 200 拒绝（批次级预约安全上限）", () => {
    expect(() =>
      createExperimentTaskWithSamplesSchema.parse({
        experimentType: "建库",
        sampleIds: Array.from({ length: 201 }, (_, i) => `id${i}`),
      })
    ).toThrow()
  })

  it("缺 experimentType 拒绝", () => {
    expect(() =>
      createExperimentTaskWithSamplesSchema.parse({ sampleIds: ["a"] })
    ).toThrow()
  })

  it("sampleIds 含空串拒绝", () => {
    expect(() =>
      createExperimentTaskWithSamplesSchema.parse({
        experimentType: "建库",
        sampleIds: ["a", ""],
      })
    ).toThrow()
  })

  it("边界：1 个 + 200 个都通过", () => {
    expect(() =>
      createExperimentTaskWithSamplesSchema.parse({
        experimentType: "建库",
        sampleIds: ["only"],
      })
    ).not.toThrow()
    expect(() =>
      createExperimentTaskWithSamplesSchema.parse({
        experimentType: "建库",
        sampleIds: Array.from({ length: 200 }, (_, i) => `id${i}`),
      })
    ).not.toThrow()
  })
})
