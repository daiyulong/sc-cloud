import { describe, it, expect } from "vitest"
import { UserRole } from "@/lib/enums"
import {
  buildExperimentTaskScope,
  buildSampleScope,
  samplesAwaitingTaskWhere,
  tasksAwaitingBioinfoWhere,
} from "@/lib/auth/role-scope"
import { sampleListQuerySchema } from "@/lib/schemas/sample"
import { experimentTaskListQuerySchema } from "@/lib/schemas/experiment-task"

// 创建接缝修复：待建子实体队列 + 行级 pool 例外（鸡生蛋）
describe("seam pool 可见范围", () => {
  it("实验员样本范围含「待建实验任务池」", () => {
    const scope = buildSampleScope(UserRole.lab_operator, "u1")
    expect(scope.OR).toContainEqual(samplesAwaitingTaskWhere)
  })

  it("分析员实验任务范围含「待建生信池」", () => {
    const scope = buildExperimentTaskScope(UserRole.bioinfo_analyst, "u1")
    expect(scope.OR).toContainEqual(tasksAwaitingBioinfoWhere)
  })

  it("收样员/项目经理样本范围不含待建任务池（不扩权）", () => {
    expect(buildSampleScope(UserRole.sample_receiver, "u1").OR ?? []).not.toContainEqual(
      samplesAwaitingTaskWhere
    )
    expect(buildSampleScope(UserRole.project_manager, "u1").OR ?? []).not.toContainEqual(
      samplesAwaitingTaskWhere
    )
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
