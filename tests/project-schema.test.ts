import { describe, expect, it } from "vitest"
import { ProjectStatus, ServiceLevel } from "@/lib/enums"
import { createProjectSchema, projectListQuerySchema } from "@/lib/schemas/project"

describe("project schemas", () => {
  it("accepts a valid project payload", () => {
    const parsed = createProjectSchema.parse({
      contractNo: "BPC202602144",
      customerOrg: "示例客户",
      customerName: "张三",
      projectType: "单细胞转录组",
      serviceItems: "10x 3' 转录组",
      serviceLevel: ServiceLevel.standard,
      priority: "普通",
      expectedDeliveryDate: "2026-06-10",
      sampleNo: "YP20260504587",
      sampleCount: "3",
    })

    expect(parsed.expectedDeliveryDate).toBeInstanceOf(Date)
    expect(parsed.sampleCount).toBe(3)
  })

  it("rejects direct status writes in project create payload", () => {
    const parsed = createProjectSchema.safeParse({
      contractNo: "BPC202602144",
      customerOrg: "示例客户",
      customerName: "张三",
      projectType: "单细胞转录组",
      serviceItems: "10x 3' 转录组",
      serviceLevel: ServiceLevel.standard,
      priority: "普通",
      sampleNo: "YP20260504587",
      sampleCount: "1",
      status: ProjectStatus.completed,
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect("status" in parsed.data).toBe(false)
    }
  })

  it("parses list filters（status 单值串 → 1 元素数组）", () => {
    expect(
      projectListQuerySchema.parse({
        q: "BP-G",
        status: ProjectStatus.waiting_sample,
        serviceLevel: ServiceLevel.qc,
      })
    ).toMatchObject({
      q: "BP-G",
      status: [ProjectStatus.waiting_sample],
      serviceLevel: ServiceLevel.qc,
    })
  })

  it("parses multi-status: 逗号分隔去重、丢弃非法、空则 undefined", () => {
    expect(
      projectListQuerySchema.parse({
        status: `${ProjectStatus.completed},${ProjectStatus.abnormal},bogus,${ProjectStatus.completed}`,
      }).status
    ).toEqual([ProjectStatus.completed, ProjectStatus.abnormal])

    expect(projectListQuerySchema.parse({ status: "bogus" }).status).toBeUndefined()
    expect(projectListQuerySchema.parse({}).status).toBeUndefined()
  })

  it("accepts the due=soon filter", () => {
    expect(projectListQuerySchema.parse({ due: "soon" })).toMatchObject({ due: "soon" })
    expect(() => projectListQuerySchema.parse({ due: "later" })).toThrow()
  })
})
