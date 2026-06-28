import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { buildProjectScope } from "@/lib/auth/role-scope"
import {
  ProjectStatus,
  type SuspensionType as SuspensionTypeValue,
  type UserRole as UserRoleValue,
} from "@/lib/enums"

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

  const [sampleTotal, completedRows, speciesRows, tissueRows, metricSamples] =
    await Promise.all([
      prisma.sample.count({ where: sampleScope }),
      prisma.project.findMany({
        where: { AND: [scope, { status: ProjectStatus.completed }, { deliveredAt: { gte: windowStart } }] },
        select: { deliveredAt: true },
      }),
      prisma.sample.groupBy({ by: ["species"], where: sampleScope, _count: { _all: true } }),
      prisma.sample.groupBy({ by: ["tissueType"], where: sampleScope, _count: { _all: true } }),
      // 产出指标已迁到样本叶子（一行一捕获）：直接查叶子
      prisma.sample.findMany({
        where: { project: scope, capturedCells: { not: null } },
        select: { capturedCells: true, species: true },
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

  // 捕获细胞数按物种均值（叶子粒度）
  const bySpecies = new Map<string, { sum: number; n: number }>()
  for (const s of metricSamples) {
    if (s.capturedCells == null) continue
    const sp = s.species?.trim() || "未填"
    const cur = bySpecies.get(sp) ?? { sum: 0, n: 0 }
    cur.sum += s.capturedCells
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

// ---------- 相似经验检索 ----------

export type SimilarFilters = {
  species?: string
  tissue?: string
  runMethod?: string
  suspensionType?: SuspensionTypeValue
}

export type SimilarRun = {
  id: string
  taskNo: string
  projectNo: string | null
  species: string | null
  tissueType: string | null
  runMethod: string | null
  suspensionType: string | null
  capturedCells: number | null
  medianGenes: number | null
  sequencingAmount: number | null
  viability: number | null
}

export type SimilarStat = { median: number; n: number } | null

export type SimilarResult = {
  total: number
  capturedCells: SimilarStat
  medianGenes: SimilarStat
  viability: SimilarStat
  runs: SimilarRun[]
}

function median(values: number[]): SimilarStat {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const m = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  return { median: Math.round(m * 10) / 10, n: values.length }
}

/** 是否带了任一检索维度（无维度 = 浏览全部有产出的历史上机） */
export function hasSimilarFilters(f: SimilarFilters): boolean {
  return Boolean(f.species || f.tissue || f.runMethod || f.suspensionType)
}

/**
 * 相似经验检索：按 物种/组织/建库化学/悬液类型 匹配历史「已完成且有产出指标」的上机记录，
 * 给出捕获细胞数/基因中位数/活率的中位数（术前参考）+ 命中明细。脏字段用 contains 模糊匹配。
 */
export async function searchSimilarRuns(
  operator: AnalyticsOperator,
  filters: SimilarFilters
): Promise<SimilarResult> {
  const scope = buildProjectScope(operator.role, operator.id)
  const ci = (v: string): Prisma.StringFilter => ({ contains: v.trim(), mode: "insensitive" })

  // 一行一捕获 = 一条样本叶子（产出/QC 挂叶子）；建库化学/任务号经其上机任务取
  const and: Prisma.SampleWhereInput[] = [
    { project: scope },
    // 只取「有产出」的历史，才有参考价值
    { OR: [{ capturedCells: { not: null } }, { medianGenes: { not: null } }] },
  ]
  if (filters.species) and.push({ species: ci(filters.species) })
  if (filters.tissue) and.push({ tissueType: ci(filters.tissue) })
  if (filters.suspensionType) and.push({ suspensionType: filters.suspensionType })
  if (filters.runMethod) {
    and.push({ taskSamples: { some: { task: { runMethod: ci(filters.runMethod) } } } })
  }

  const [totalCount, samples] = await Promise.all([
    prisma.sample.count({ where: { AND: and } }),
    prisma.sample.findMany({
      where: { AND: and },
      select: {
        id: true,
        sampleName: true,
        species: true,
        tissueType: true,
        suspensionType: true,
        capturedCells: true,
        medianGenes: true,
        sequencingAmount: true,
        project: { select: { projectNo: true } },
        qcRecords: { select: { viability: true }, orderBy: { createdAt: "desc" }, take: 1 },
        taskSamples: {
          select: { task: { select: { taskNo: true, runMethod: true } } },
          orderBy: { task: { updatedAt: "desc" } },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ])

  const runs: SimilarRun[] = samples.map((s) => ({
    id: s.id,
    taskNo: s.taskSamples[0]?.task.taskNo ?? s.sampleName ?? s.id,
    projectNo: s.project.projectNo,
    species: s.species,
    tissueType: s.tissueType,
    runMethod: s.taskSamples[0]?.task.runMethod ?? null,
    suspensionType: s.suspensionType,
    capturedCells: s.capturedCells,
    medianGenes: s.medianGenes,
    sequencingAmount: s.sequencingAmount,
    viability: s.qcRecords[0]?.viability ?? null,
  }))

  const pick = (key: "capturedCells" | "medianGenes" | "viability") =>
    median(runs.map((r) => r[key]).filter((v): v is number => v != null))

  return {
    total: totalCount,
    capturedCells: pick("capturedCells"),
    medianGenes: pick("medianGenes"),
    viability: pick("viability"),
    runs: runs.slice(0, 50),
  }
}
