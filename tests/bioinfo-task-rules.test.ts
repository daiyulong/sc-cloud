import { describe, expect, it } from "vitest"
import { getAvailableBioinfoTaskActions } from "@/lib/bioinfo-tasks/rules"
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

  it("管理员 / 项目经理可执行；销售 / 接收员 / 实验员 / 查看者无权", () => {
    for (const role of [UserRole.admin, UserRole.project_manager]) {
      expect(getAvailableBioinfoTaskActions(BioinfoTaskStatus.pending, role)).toEqual(["start"])
    }
    for (const role of [
      UserRole.sales_owner,
      UserRole.sample_receiver,
      UserRole.lab_operator,
      UserRole.viewer,
      undefined,
    ]) {
      expect(getAvailableBioinfoTaskActions(BioinfoTaskStatus.in_progress, role)).toEqual([])
    }
  })
})
