import { describe, expect, it } from "vitest"
import { describeOperationLog } from "@/lib/operation-log-describe"

describe("describeOperationLog", () => {
  it("项目状态变更：显示中文状态转移", () => {
    const d = describeOperationLog({
      entityType: "project",
      action: "status_change",
      beforeData: { status: "draft", projectNo: null },
      afterData: { status: "waiting_sample", projectNo: "BP-G260504587" },
    })
    expect(d.title).toBe("项目 BP-G260504587")
    expect(d.transition).toBe("草稿 → 待到样")
  })

  it("创建样本：带样本编号", () => {
    const d = describeOperationLog({
      entityType: "sample",
      action: "create",
      afterData: { sampleNo: "YP0003", status: "waiting_arrival" },
    })
    expect(d.title).toBe("创建样本 YP0003")
  })

  it("创建项目草稿：无编号则不带名", () => {
    const d = describeOperationLog({
      entityType: "project",
      action: "create",
      afterData: { projectNo: null, status: "draft" },
    })
    expect(d.title).toBe("创建项目")
  })

  it("产出指标补录：kind=run_metrics", () => {
    const d = describeOperationLog({
      entityType: "experiment_task",
      action: "update",
      afterData: { kind: "run_metrics", task: { taskNo: "BP-E01" } },
    })
    expect(d.title).toBe("录入产出指标 BP-E01")
  })

  it("质控：kind=qc_record", () => {
    const d = describeOperationLog({
      entityType: "experiment_task",
      action: "create",
      afterData: { kind: "qc_record", qcRecord: {} },
    })
    expect(d.title).toBe("录入质控")
  })

  it("聚合级联：剥开 wrapped 实体取状态转移", () => {
    const d = describeOperationLog({
      entityType: "bioinfo_task",
      action: "status_change",
      beforeData: { status: "waiting_delivery", taskNo: "BP-B01" },
      afterData: { task: { status: "delivered", taskNo: "BP-B01" }, trigger: "project:x:deliver" },
    })
    expect(d.title).toBe("生信任务 BP-B01")
    expect(d.transition).toBe("待交付 → 已交付")
  })

  it("实体快照含 include 的嵌套关系：用快照本身、不被嵌套 project 带偏", () => {
    const d = describeOperationLog({
      entityType: "sample",
      action: "status_change",
      beforeData: { status: "waiting_arrival", sampleNo: "YP9", project: { status: "waiting_sample" } },
      afterData: { status: "received", sampleNo: "YP9", project: { status: "sample_received" } },
    })
    expect(d.title).toBe("样本 YP9")
    expect(d.transition).toBe("待到样 → 已接收")
  })

  it("未知/缺失数据：退化为通用标题，不抛错", () => {
    const d = describeOperationLog({ entityType: "user", action: "update", afterData: null })
    expect(d.title).toContain("用户")
    expect(d.transition).toBeUndefined()
  })
})
