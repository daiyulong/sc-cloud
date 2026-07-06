import { describe, expect, it } from "vitest"
import { partitionProjectActions } from "@/components/projects/project-action-config"
import { ProjectStatus, UserRole } from "@/lib/enums"

describe("partitionProjectActions", () => {
  it("draft + PM：主动作 confirm（direct 直接执行），破坏性动作进溢出", () => {
    const { primary, overflow } = partitionProjectActions(
      ProjectStatus.draft,
      UserRole.project_manager
    )
    expect(primary?.action).toBe("confirm")
    expect(primary?.kind).toBe("direct")
    expect(overflow.map((d) => d.action)).toEqual(["markAbnormal", "terminate"])
    expect(overflow.every((d) => d.destructive)).toBe(true)
  })

  it("waiting_delivery + admin：主动作 deliver 走轻确认 Dialog（直接关项目）", () => {
    const { primary } = partitionProjectActions(ProjectStatus.waiting_delivery, UserRole.admin)
    expect(primary?.action).toBe("deliver")
    expect(primary?.kind).toBe("confirmDialog")
  })

  it("abnormal + PM：主动作 recover（原因可选），溢出 terminate", () => {
    const { primary, overflow } = partitionProjectActions(
      ProjectStatus.abnormal,
      UserRole.project_manager
    )
    expect(primary?.action).toBe("recover")
    expect(primary?.label).toBe("解除异常")
    expect(primary?.kind).toBe("reasonDialog")
    expect(primary?.reasonRequired).toBe(false)
    expect(overflow.map((d) => d.action)).toEqual(["terminate"])
    expect(overflow[0]?.label).toBe("终止项目")
  })

  it("中段状态（实验中）：无主动作，破坏性动作全在溢出", () => {
    const { primary, overflow } = partitionProjectActions(
      ProjectStatus.lab_in_progress,
      UserRole.admin
    )
    expect(primary).toBeUndefined()
    expect(overflow.map((d) => d.action)).toEqual(["markAbnormal", "terminate"])
  })

  it("markAbnormal 原因必填（与 projectReasonSchema 对齐）", () => {
    const { overflow } = partitionProjectActions(ProjectStatus.draft, UserRole.admin)
    const markAbnormal = overflow.find((d) => d.action === "markAbnormal")
    expect(markAbnormal?.reasonRequired).toBe(true)
  })

  it("无权限角色（销售/查看者）：两侧都为空", () => {
    for (const role of [UserRole.sales_owner, UserRole.viewer]) {
      const { primary, overflow } = partitionProjectActions(ProjectStatus.draft, role)
      expect(primary).toBeUndefined()
      expect(overflow).toEqual([])
    }
  })

  it("终态（completed/terminated）：无任何动作", () => {
    for (const status of [ProjectStatus.completed, ProjectStatus.terminated]) {
      const { primary, overflow } = partitionProjectActions(status, UserRole.admin)
      expect(primary).toBeUndefined()
      expect(overflow).toEqual([])
    }
  })
})
