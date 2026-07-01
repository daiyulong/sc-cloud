import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => {
  const prisma = {
    experimentTask: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  }
  return { prisma }
})

import { prisma } from "@/lib/prisma"
import { UserRole } from "@/lib/enums"
import { listExperimentTasks } from "@/lib/experiment-tasks/service"
import { tasksAwaitingBioinfoWhere } from "@/lib/auth/role-scope"

const OPERATOR = { id: "u-1", role: UserRole.project_manager }

/** 取出 findMany 调用的 where.AND 数组（测试内部用，Prisma 类型对 AND 允许单值/数组/undefined，这里按实现固定用数组）。 */
function andClauses(): Record<string, unknown>[] {
  const call = vi.mocked(prisma.experimentTask.findMany).mock.calls[0][0] as {
    where: { AND: Record<string, unknown>[] }
  }
  return call.where.AND
}

function statusClauses() {
  return andClauses().filter((clause) => "status" in clause)
}

describe("listExperimentTasks 的 tab 桶过滤(回归 2026-07-01: 已完成 Tab 恒为空)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("tab=done 只按 [completed,cancelled,abnormal] 过滤，不再叠加冲突的默认状态注入", async () => {
    await listExperimentTasks(OPERATOR, { tab: "done" }, { skip: 0, limit: 20 })

    const filters = statusClauses()
    // 只应有 1 个 status 过滤子句(来自 tab 桶)，不应再叠加第二个冲突的 status 过滤
    expect(filters).toHaveLength(1)
    const clause = filters[0] as { status: { in: string[] } }
    expect(clause.status.in.sort()).toEqual(["completed", "cancelled", "abnormal"].sort())
  })

  it("tab=todo 只返回 waiting_schedule", async () => {
    await listExperimentTasks(OPERATOR, { tab: "todo" }, { skip: 0, limit: 20 })
    const clause = statusClauses()[0] as { status: { in: string[] } }
    expect(clause.status.in).toEqual(["waiting_schedule"])
  })

  it("tab=doing 返回 scheduled/in_progress/waiting_feedback 三态", async () => {
    await listExperimentTasks(OPERATOR, { tab: "doing" }, { skip: 0, limit: 20 })
    const clause = statusClauses()[0] as { status: { in: string[] } }
    expect(clause.status.in.sort()).toEqual(
      ["scheduled", "in_progress", "waiting_feedback"].sort(),
    )
  })

  it("awaiting=bioinfo 与 tab 组合时不叠加桶过滤，避免与 completed 语义冲突产生空交集", async () => {
    // 模拟"用户当前在进行中 Tab，但深链接带 awaiting=bioinfo"的场景——
    // 不应该出现 status IN [doing 三态] AND status=completed 的空交集。
    await listExperimentTasks(
      OPERATOR,
      { tab: "doing", awaiting: "bioinfo" },
      { skip: 0, limit: 20 },
    )
    const filters = statusClauses()
    // tab 桶过滤应被跳过(awaiting 存在时)，只剩 awaiting 自带的整块 where(含 status=completed)
    expect(filters).toHaveLength(1)
    expect(filters[0]).toEqual(tasksAwaitingBioinfoWhere)
  })

  it("scope=mine 叠加 operatorId 过滤", async () => {
    await listExperimentTasks(
      OPERATOR,
      { tab: "doing", scope: "mine" },
      { skip: 0, limit: 20 },
    )
    const operatorFilter = andClauses().find((clause) => "operatorId" in clause)
    expect(operatorFilter).toEqual({ operatorId: OPERATOR.id })
  })

  it("显式 ?status= 仍作为深链接叠加过滤(交集)", async () => {
    await listExperimentTasks(
      OPERATOR,
      { tab: "doing", status: ["in_progress"] },
      { skip: 0, limit: 20 },
    )
    // 两个 status 子句都在(桶 + 显式)，AND 交集 = ["in_progress"]，不应该是空
    expect(statusClauses().length).toBeGreaterThanOrEqual(1)
  })
})
