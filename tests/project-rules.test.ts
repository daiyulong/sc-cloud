import { describe, expect, it } from "vitest"
import { ProjectStatus, UserRole } from "@/lib/enums"
import {
  ProjectDomainError,
  ensureProjectCanMarkAbnormal,
  ensureProjectStatus,
  getAvailableProjectActions,
} from "@/lib/projects/rules"

describe("project rules", () => {
  it("exposes project manager actions by status", () => {
    // 确认项目直接进待到样（无 confirmed 中间态），确认交付直接关项目（无 delivered 中间态）
    expect(getAvailableProjectActions(ProjectStatus.draft, UserRole.project_manager)).toContain(
      "confirm"
    )
    expect(
      getAvailableProjectActions(ProjectStatus.waiting_delivery, UserRole.project_manager)
    ).toContain("deliver")
  })

  it("does not expose state actions to sales owner", () => {
    expect(getAvailableProjectActions(ProjectStatus.draft, UserRole.sales_owner)).toEqual([])
  })

  it("rejects invalid status transition preconditions", () => {
    expect(() =>
      ensureProjectStatus(ProjectStatus.waiting_sample, [ProjectStatus.draft], "确认项目")
    ).toThrow(ProjectDomainError)
  })

  it("rejects abnormal marking for terminal projects", () => {
    expect(() => ensureProjectCanMarkAbnormal(ProjectStatus.completed)).toThrow(
      ProjectDomainError
    )
  })
})
