import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => {
  const prisma = {
    bioinfoTask: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  }
  return { prisma }
})

import { prisma } from "@/lib/prisma"
import { UserRole } from "@/lib/enums"
import { listBioinfoTasks } from "@/lib/bioinfo-tasks/service"
import { ANALYST_UNASSIGNED } from "@/lib/schemas/bioinfo-task"

const OPERATOR = { id: "u-1", role: UserRole.project_manager }

/** 取出 findMany 调用的 where.AND 数组。 */
function andClauses(): Record<string, unknown>[] {
  const call = vi.mocked(prisma.bioinfoTask.findMany).mock.calls[0][0] as {
    where: { AND: Record<string, unknown>[] }
  }
  return call.where.AND
}

function analystClause() {
  return andClauses().find((clause) => "analystId" in clause)
}

// 「分析负责人」菜单：真实分析员 id 按 id 过滤；哨兵 unassigned 映射为 analystId 为空
// （否则会被当成真实 id 查、静默查不到）。见 lib/schemas/bioinfo-task ANALYST_UNASSIGNED。
describe("listBioinfoTasks 的 analystId 过滤", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("给定分析员 id → 按该 id 过滤", async () => {
    await listBioinfoTasks(OPERATOR, { analystId: "analyst-9" }, { skip: 0, limit: 20 })
    expect(analystClause()).toEqual({ analystId: "analyst-9" })
  })

  it("哨兵 unassigned → analystId 为空（未分配）", async () => {
    await listBioinfoTasks(OPERATOR, { analystId: ANALYST_UNASSIGNED }, { skip: 0, limit: 20 })
    expect(analystClause()).toEqual({ analystId: null })
  })

  it("不给 analystId → 不叠加 analystId 过滤", async () => {
    await listBioinfoTasks(OPERATOR, {}, { skip: 0, limit: 20 })
    expect(analystClause()).toBeUndefined()
  })
})
