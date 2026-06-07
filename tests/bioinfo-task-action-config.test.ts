import { describe, expect, it } from "vitest"
import { partitionBioinfoTaskActions } from "@/components/bioinfo-tasks/bioinfo-task-action-config"
import { BioinfoTaskStatus, UserRole } from "@/lib/enums"

describe("partitionBioinfoTaskActions", () => {
  it("待开始：主动作 start（direct），无溢出", () => {
    const { primary, overflow } = partitionBioinfoTaskActions(
      BioinfoTaskStatus.pending,
      UserRole.bioinfo_analyst
    )
    expect(primary?.action).toBe("start")
    expect(primary?.kind).toBe("direct")
    expect(overflow).toEqual([])
  })

  it("分析中：主动作 submit（提交 Dialog），溢出 review", () => {
    const { primary, overflow } = partitionBioinfoTaskActions(
      BioinfoTaskStatus.in_progress,
      UserRole.bioinfo_analyst
    )
    expect(primary?.action).toBe("submit")
    expect(primary?.kind).toBe("submitDialog")
    expect(overflow.map((d) => d.action)).toEqual(["review"])
  })

  it("待审核：主动作 submit，无溢出", () => {
    const { primary, overflow } = partitionBioinfoTaskActions(
      BioinfoTaskStatus.waiting_review,
      UserRole.bioinfo_analyst
    )
    expect(primary?.action).toBe("submit")
    expect(overflow).toEqual([])
  })

  it("无权限角色：主/溢出均空", () => {
    const { primary, overflow } = partitionBioinfoTaskActions(
      BioinfoTaskStatus.in_progress,
      UserRole.viewer
    )
    expect(primary).toBeUndefined()
    expect(overflow).toEqual([])
  })
})
