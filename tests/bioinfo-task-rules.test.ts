import { describe, expect, it } from "vitest"
import {
  BioinfoTaskDomainError,
  getAvailableBioinfoTaskActions,
  resolveStartAnalyst,
} from "@/lib/bioinfo-tasks/rules"
import { BioinfoTaskStatus, UserRole } from "@/lib/enums"

describe("getAvailableBioinfoTaskActions", () => {
  it("待开始 + 分析员：仅开始分析", () => {
    expect(
      getAvailableBioinfoTaskActions(BioinfoTaskStatus.pending, UserRole.bioinfo_analyst)
    ).toEqual(["start"])
  })

  it("分析中：提交报告（主）+ 提交审核", () => {
    expect(
      getAvailableBioinfoTaskActions(BioinfoTaskStatus.in_progress, UserRole.bioinfo_analyst)
    ).toEqual(["submit", "review"])
  })

  it("待审核：仅提交报告", () => {
    expect(
      getAvailableBioinfoTaskActions(BioinfoTaskStatus.waiting_review, UserRole.bioinfo_analyst)
    ).toEqual(["submit"])
  })

  it("终态（待交付/已交付/异常）：无任何动作", () => {
    for (const status of [
      BioinfoTaskStatus.waiting_delivery,
      BioinfoTaskStatus.delivered,
      BioinfoTaskStatus.abnormal,
    ]) {
      expect(getAvailableBioinfoTaskActions(status, UserRole.bioinfo_analyst)).toEqual([])
    }
  })

  it("在岗角色可执行（开放协作，含销售/接收/实验替班）；仅 viewer/空角色无权", () => {
    for (const role of [
      UserRole.admin,
      UserRole.project_manager,
      UserRole.sales_owner,
      UserRole.sample_receiver,
      UserRole.lab_operator,
    ]) {
      expect(getAvailableBioinfoTaskActions(BioinfoTaskStatus.pending, role)).toEqual(["start"])
    }
    for (const role of [UserRole.viewer, undefined]) {
      expect(getAvailableBioinfoTaskActions(BioinfoTaskStatus.in_progress, role)).toEqual([])
    }
  })
})

// 不变量：离开 pending 必有负责人。谁开始谁负责。
describe("resolveStartAnalyst", () => {
  const base = {
    explicitAnalystId: undefined,
    currentAnalystId: null,
    operatorId: "op-1",
    operatorRole: UserRole.bioinfo_analyst as string | undefined,
  }

  it("显式指定优先于一切", () => {
    expect(
      resolveStartAnalyst({ ...base, explicitAnalystId: "a-9", currentAnalystId: "a-2" })
    ).toBe("a-9")
  })

  it("任务已有负责人则沿用（分析员本人开始也不覆盖既有）", () => {
    expect(resolveStartAnalyst({ ...base, currentAnalystId: "a-2" })).toBe("a-2")
  })

  it("未分配 + 分析员本人开始 → 自动认领当前操作者", () => {
    expect(resolveStartAnalyst({ ...base, operatorId: "me", operatorRole: UserRole.bioinfo_analyst })).toBe("me")
  })

  it("未分配 + 非分析员代推进且未显式指定 → 报错要求先指定", () => {
    expect(() =>
      resolveStartAnalyst({ ...base, operatorRole: UserRole.project_manager })
    ).toThrow(BioinfoTaskDomainError)
  })

  it("未分配 + 非分析员但显式指定了负责人 → 用指定值", () => {
    expect(
      resolveStartAnalyst({
        ...base,
        explicitAnalystId: "a-7",
        operatorRole: UserRole.project_manager,
      })
    ).toBe("a-7")
  })
})
