import { prisma } from "@/lib/prisma"
import { buildProjectScope } from "@/lib/auth/role-scope"
import { ProjectStatus, type UserRole as UserRoleValue } from "@/lib/enums"

export type AnalyticsOperator = { id: string; role?: UserRoleValue }

const TOP_N = 8
const MONTHS = 6

export type NamedCount = { name: string; count: number }
export type SpeciesMetric = { name: string; avg: number; n: number }

export type Analytics = {
  // 注：项目当前状态各计数在工作台「项目流转」轨道展示，经验库不重复，仅做趋势/构成/产出
  sampleTotal: number
  completedByMonth: { month: string; count: number }[]
  speciesDist: NamedCount[]
  tissueDist: NamedCount[]
  capturedCellsBySpecies: SpeciesMetric[]
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** 把 groupBy 结果归一为 Top N（空值并入「未填」，按数量降序，超出并入「其他」） */
function topN(rows: { key: string | null; count: number }[]): NamedCount[] {
  const named = rows.map((r) => ({ name: r.key?.trim() || "未填", count: r.count }))
  named.sort((a, b) => b.count - a.count)
  if (named.length <= TOP_N) return named
  const head = named.slice(0, TOP_N)
  const rest = named.slice(TOP_N).reduce((s, r) => s + r.count, 0)
  return rest > 0 ? [...head, { name: "其他", count: rest }] : head
}

export async function getAnalytics(operator: AnalyticsOperator): Promise<Analytics> {
  const scope = buildProjectScope(operator.role, operator.id)
  const sampleScope = { project: scope }

  // 近 N 个月窗口（含本月），按完成（deliveredAt）月份分桶
  const windowStart = new Date()
  windowStart.setHours(0, 0, 0, 0)
  windowStart.setDate(1)
  windowStart.setMonth(windowStart.getMonth() - (MONTHS - 1))

  const [sampleTotal, completedRows, speciesRows, tissueRows, metricTasks] =
    await Promise.all([
      prisma.sample.count({ where: sampleScope }),
      prisma.project.findMany({
        where: { AND: [scope, { status: ProjectStatus.completed }, { deliveredAt: { gte: windowStart } }] },
        select: { deliveredAt: true },
      }),
      prisma.sample.groupBy({ by: ["species"], where: sampleScope, _count: { _all: true } }),
      prisma.sample.groupBy({ by: ["tissueType"], where: sampleScope, _count: { _all: true } }),
      prisma.experimentTask.findMany({
        where: { project: scope, capturedCells: { not: null } },
        select: { capturedCells: true, sample: { select: { species: true } } },
      }),
    ])

  // 月份分桶（预填 N 个月，保证连续）
  const buckets = new Map<string, number>()
  for (let i = 0; i < MONTHS; i++) {
    const d = new Date(windowStart)
    d.setMonth(d.getMonth() + i)
    buckets.set(monthKey(d), 0)
  }
  for (const row of completedRows) {
    if (!row.deliveredAt) continue
    const k = monthKey(row.deliveredAt)
    if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1)
  }
  const completedByMonth = [...buckets.entries()].map(([month, count]) => ({
    month: `${Number(month.slice(5))}月`,
    count,
  }))

  // 捕获细胞数按物种均值
  const bySpecies = new Map<string, { sum: number; n: number }>()
  for (const t of metricTasks) {
    if (t.capturedCells == null) continue
    const sp = t.sample?.species?.trim() || "未填"
    const cur = bySpecies.get(sp) ?? { sum: 0, n: 0 }
    cur.sum += t.capturedCells
    cur.n += 1
    bySpecies.set(sp, cur)
  }
  const capturedCellsBySpecies: SpeciesMetric[] = [...bySpecies.entries()]
    .map(([name, { sum, n }]) => ({ name, avg: Math.round(sum / n), n }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, TOP_N)

  return {
    sampleTotal,
    completedByMonth,
    speciesDist: topN(speciesRows.map((r) => ({ key: r.species, count: r._count._all }))),
    tissueDist: topN(tissueRows.map((r) => ({ key: r.tissueType, count: r._count._all }))),
    capturedCellsBySpecies,
  }
}
