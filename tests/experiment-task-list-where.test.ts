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

// 2026-07-01 revert: 状态 Tab/桶系统整体撤销(见 ADR-0003 "彻底revert"记录)。
// /lab 恢复与 /projects /bioinfo-tasks /intake 一致的多选状态过滤(page 层
// 计算默认值，service 层只管按 query.status 过滤，无任何 tab/桶概念)。
describe("listExperimentTasks 的 where 拼装(无 tab/桶概念)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("不给 status 时不叠加任何 status 过滤(由 page 层决定是否注入默认)", async () => {
    await listExperimentTasks(OPERATOR, {}, { skip: 0, limit: 20 })
    expect(statusClauses()).toHaveLength(0)
  })

  it("显式 ?status= 按给定集合过滤", async () => {
    await listExperimentTasks(
      OPERATOR,
      { status: ["in_progress", "waiting_feedback"] },
      { skip: 0, limit: 20 },
    )
    const filters = statusClauses()
    expect(filters).toHaveLength(1)
    const clause = filters[0] as { status: { in: string[] } }
    expect(clause.status.in.sort()).toEqual(["in_progress", "waiting_feedback"].sort())
  })

  it("awaiting=bioinfo 使用专属 where(不受 status 影响)", async () => {
    await listExperimentTasks(OPERATOR, { awaiting: "bioinfo" }, { skip: 0, limit: 20 })
    const awaitingClause = andClauses().find(
      (clause) => JSON.stringify(clause) === JSON.stringify(tasksAwaitingBioinfoWhere),
    )
    expect(awaitingClause).toEqual(tasksAwaitingBioinfoWhere)
  })

  it("显式 ?operatorId= 仍作为深链接/API 过滤能力(不在 UI 暴露,见 ADR-0003 我的/团队移除记录)", async () => {
    await listExperimentTasks(OPERATOR, { operatorId: "other-user-id" }, { skip: 0, limit: 20 })
    const operatorFilter = andClauses().find((clause) => "operatorId" in clause)
    expect(operatorFilter).toEqual({ operatorId: "other-user-id" })
  })

  it("projectId 过滤照常生效", async () => {
    await listExperimentTasks(OPERATOR, { projectId: "proj-1" }, { skip: 0, limit: 20 })
    const projectFilter = andClauses().find((clause) => "projectId" in clause)
    expect(projectFilter).toEqual({ projectId: "proj-1" })
  })

  it("date=week 按未来 7 天(含今日)过滤 plannedDate(参考 Vercel Last 7 Days 加的「计划日期」筛选)", async () => {
    await listExperimentTasks(OPERATOR, { date: "week" }, { skip: 0, limit: 20 })
    const dateFilter = andClauses().find((clause) => "plannedDate" in clause) as {
      plannedDate: { gte: Date; lt: Date }
    }
    expect(dateFilter).toBeDefined()
    const spanDays = (dateFilter.plannedDate.lt.getTime() - dateFilter.plannedDate.gte.getTime()) / 86400000
    expect(spanDays).toBe(7)
  })
})
