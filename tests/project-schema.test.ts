import { describe, expect, it } from "vitest"
import { ProjectStatus, ServiceLevel } from "@/lib/enums"
import { createProjectSchema, projectListQuerySchema } from "@/lib/schemas/project"

describe("project schemas", () => {
  it("accepts a valid project payload", () => {
    const parsed = createProjectSchema.parse({
      contractNo: "BPC202602144",
      orderNo: "BP-G260505472",
      customerOrg: "示例客户",
      customerName: "张三",
      projectType: "单细胞转录组",
      serviceItems: "10x 3' 转录组",
      serviceLevel: ServiceLevel.standard,
      priority: "普通",
      expectedDeliveryDate: "2026-06-10",
    })

    expect(parsed.expectedDeliveryDate).toBeInstanceOf(Date)
  })

  it("rejects direct status writes in project create payload", () => {
    const parsed = createProjectSchema.safeParse({
      contractNo: "BPC202602144",
      orderNo: "BP-G260505472",
      customerOrg: "示例客户",
      customerName: "张三",
      projectType: "单细胞转录组",
      serviceItems: "10x 3' 转录组",
      serviceLevel: ServiceLevel.standard,
      priority: "普通",
      status: ProjectStatus.completed,
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect("status" in parsed.data).toBe(false)
    }
  })

  it("parses list filters", () => {
    expect(
      projectListQuerySchema.parse({
        q: "BP-G",
        status: ProjectStatus.waiting_sample,
        serviceLevel: ServiceLevel.qc,
      })
    ).toMatchObject({
      q: "BP-G",
      status: ProjectStatus.waiting_sample,
      serviceLevel: ServiceLevel.qc,
    })
  })
})
