import { describe, it, expect } from "vitest"
import { UserRole } from "@/lib/enums"
import {
  buildBioinfoTaskScope,
  buildExperimentTaskScope,
  buildProjectScope,
  buildSampleBatchScope,
} from "@/lib/auth/role-scope"
import { sampleListQuerySchema } from "@/lib/schemas/sample"
import { experimentTaskListQuerySchema } from "@/lib/schemas/experiment-task"

// 行级可见范围：内部提效系统全员开放（2026-06 反转 §3.3，原"鸡生蛋池例外"随硬 scope 一并移除）。
describe("行级可见范围：全员开放", () => {
  const allRoles = [
    UserRole.admin,
    UserRole.project_manager,
    UserRole.sales_owner,
    UserRole.sample_receiver,
    UserRole.lab_operator,
    UserRole.bioinfo_analyst,
    UserRole.viewer,
  ] as const

  it("所有在册角色（含只读 viewer）scope 全开放：空 where，看到全部", () => {
    for (const role of allRoles) {
      expect(buildProjectScope(role)).toEqual({})
      expect(buildSampleBatchScope(role)).toEqual({})
      expect(buildExperimentTaskScope(role)).toEqual({})
      expect(buildBioinfoTaskScope(role)).toEqual({})
    }
  })

  it("未知/缺失角色 fail-closed：什么都看不到", () => {
    expect(buildProjectScope(undefined)).toEqual({ id: "__none__" })
    expect(buildProjectScope("bogus" as unknown as UserRole)).toEqual({ id: "__none__" })
    expect(buildSampleBatchScope(undefined)).toEqual({ id: "__none__" })
    expect(buildBioinfoTaskScope(undefined)).toEqual({ id: "__none__" })
  })
})

describe("seam 列表参数", () => {
  // 2026-06 重构：samples 列表改为样本批次粒度，received=1 仍支持；
  // 叶子级「待建实验任务」(awaiting=task) 迁到 M2 实验工位，不再挂样本(批次)列表。
  it("samples 支持 received=1", () => {
    expect(sampleListQuerySchema.parse({ received: "1" })).toMatchObject({ received: "1" })
  })

  it("experiment-tasks 支持 awaiting=bioinfo", () => {
    expect(experimentTaskListQuerySchema.parse({ awaiting: "bioinfo" })).toMatchObject({
      awaiting: "bioinfo",
    })
  })
})
