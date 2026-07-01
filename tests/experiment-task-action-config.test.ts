import { describe, expect, it } from "vitest"
import { partitionExperimentTaskActions } from "@/components/experiment-tasks/experiment-task-action-config"
import { ExperimentTaskStatus, UserRole } from "@/lib/enums"

describe("partitionExperimentTaskActions", () => {
  it("待排期：主动作 schedule（进入工作项面板），无溢出", () => {
    const { primary, overflow } = partitionExperimentTaskActions(
      ExperimentTaskStatus.waiting_schedule,
      UserRole.lab_operator
    )
    expect(primary?.action).toBe("schedule")
    expect(primary?.kind).toBe("workItem")
    expect(overflow).toEqual([])
  })

  it("已排期：主动作 start（进入工作项面板）", () => {
    const { primary, overflow } = partitionExperimentTaskActions(
      ExperimentTaskStatus.scheduled,
      UserRole.lab_operator
    )
    expect(primary?.action).toBe("start")
    expect(primary?.kind).toBe("workItem")
    expect(overflow).toEqual([])
  })

  it("进行中：主动作 feedback，溢出 finish + qc", () => {
    const { primary, overflow } = partitionExperimentTaskActions(
      ExperimentTaskStatus.in_progress,
      UserRole.lab_operator
    )
    expect(primary?.action).toBe("feedback")
    expect(primary?.kind).toBe("workItem")
    expect(overflow.map((d) => d.action)).toEqual(["finish", "qc"])
  })

  it("待提交结果：主动作 feedback，溢出 qc", () => {
    const { primary, overflow } = partitionExperimentTaskActions(
      ExperimentTaskStatus.waiting_feedback,
      UserRole.lab_operator
    )
    expect(primary?.action).toBe("feedback")
    expect(overflow.map((d) => d.action)).toEqual(["qc"])
  })

  it("无权限角色：主/溢出均空", () => {
    const { primary, overflow } = partitionExperimentTaskActions(
      ExperimentTaskStatus.in_progress,
      UserRole.viewer
    )
    expect(primary).toBeUndefined()
    expect(overflow).toEqual([])
  })
})
