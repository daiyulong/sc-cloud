import * as XLSX from "xlsx"
import prisma from "../lib/prisma"
import {
  ExperimentTaskStatus,
  ProjectStatus,
  QCResult,
  RiskLevel,
  SampleStatus,
  ServiceLevel,
  SuspensionType,
  UserRole,
} from "../lib/enums"

/**
 * Demo 经验数据 seed：把 data/单细胞项目经验.xlsx（101 行 / 43 委托单的真实上机产出）
 * 灌成 demo 已完成项目，供经验库（相似检索 + 图表）演示。**仅 demo 用**：
 * - 项目编号加 `DEMO-` 前缀（经验表委托单号与业务数据零交集、无宿主，故造 demo 宿主）
 * - 客户/服务等级等必填字段用占位（demo 不进真实运营口径）
 * - deliveredAt 散布到近 6 个月，让完成趋势图有数
 * 幂等：每次先清掉所有 DEMO- 项目及其子实体再重建。SEED_DEMO=0 可跳过（正式部署）。
 */

const PREFIX = "DEMO-"
const EXCEL = "data/单细胞项目经验.xlsx"

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

function suspensionOf(v: unknown): SuspensionType | null {
  const s = String(v ?? "").trim()
  if (s.includes("核")) return SuspensionType.nucleus
  if (s.includes("细胞")) return SuspensionType.cell
  return null
}

function qcOf(viability: number | null): { qcResult: QCResult; riskLevel: RiskLevel } {
  if (viability == null) return { qcResult: QCResult.passed, riskLevel: RiskLevel.normal }
  if (viability >= 85) return { qcResult: QCResult.passed, riskLevel: RiskLevel.normal }
  if (viability >= 70) return { qcResult: QCResult.low_risk_passed, riskLevel: RiskLevel.low_risk }
  return { qcResult: QCResult.failed, riskLevel: RiskLevel.high_risk }
}

export async function seedExperience() {
  if (process.env.SEED_DEMO === "0") {
    console.log("[seed-experience] SEED_DEMO=0，跳过 demo 经验数据")
    return
  }

  // 1. 幂等清理旧 demo
  const old = await prisma.project.findMany({ where: { projectNo: { startsWith: PREFIX } }, select: { id: true } })
  const ids = old.map((p) => p.id)
  if (ids.length) {
    const tasks = await prisma.experimentTask.findMany({ where: { projectId: { in: ids } }, select: { id: true } })
    const samples = await prisma.sample.findMany({ where: { projectId: { in: ids } }, select: { id: true } })
    await prisma.qcRecord.deleteMany({ where: { taskId: { in: tasks.map((t) => t.id) } } })
    await prisma.operationLog.deleteMany({
      where: { entityId: { in: [...ids, ...tasks.map((t) => t.id), ...samples.map((s) => s.id)] } },
    })
    await prisma.experimentTask.deleteMany({ where: { projectId: { in: ids } } })
    await prisma.sample.deleteMany({ where: { projectId: { in: ids } } })
    await prisma.project.deleteMany({ where: { id: { in: ids } } })
  }

  // 2. 读经验表
  let rows: Record<string, unknown>[]
  try {
    const wb = XLSX.readFile(EXCEL)
    rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null })
  } catch (e) {
    console.warn(`[seed-experience] 读 ${EXCEL} 失败，跳过：`, (e as Error).message)
    return
  }

  // 3. 关联用户（保证 demo 数据对 sales/pm 可见）
  const [sales, pm, lab] = await Promise.all([
    prisma.user.findFirst({ where: { role: UserRole.sales_owner }, select: { id: true } }),
    prisma.user.findFirst({ where: { role: UserRole.project_manager }, select: { id: true } }),
    prisma.user.findFirst({ where: { role: UserRole.lab_operator }, select: { id: true } }),
  ])
  if (!sales || !pm || !lab) {
    console.warn("[seed-experience] 缺 sales/pm/lab 用户，跳过")
    return
  }

  // 4. 按委托单分组
  const groups = new Map<string, Record<string, unknown>[]>()
  for (const r of rows) {
    const k = String(r["项目编号"] ?? "").trim()
    if (!k) continue
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(r)
  }

  let pi = 0
  let si = 0
  for (const [orderNo, grp] of groups) {
    const delivered = new Date()
    delivered.setHours(0, 0, 0, 0)
    delivered.setMonth(delivered.getMonth() - (pi % 6))
    delivered.setDate(1 + (pi % 25))
    const projectType = String(grp[0]["项目类型"] ?? "单细胞转录组")

    const project = await prisma.project.create({
      data: {
        projectNo: `${PREFIX}${orderNo}`,
        contractNo: "DEMO-BPC",
        customerOrg: "示例客户（demo）",
        customerName: "示例",
        projectType,
        serviceItems: projectType,
        serviceLevel: ServiceLevel.standard,
        priority: "普通",
        status: ProjectStatus.completed,
        deliveredAt: delivered,
        salesOwnerId: sales.id,
        projectManagerId: pm.id,
      },
    })

    let ei = 0
    for (const r of grp) {
      ei++
      si++
      const sample = await prisma.sample.create({
        data: {
          sampleNo: `${PREFIX}YP${String(si).padStart(3, "0")}`,
          projectId: project.id,
          species: r["物种"] ? String(r["物种"]) : null,
          tissueType: r["部位"] ? String(r["部位"]) : null,
          experimentType: projectType,
          sampleCount: 1,
          status: SampleStatus.feedback_submitted,
          receivedAt: delivered,
          receiverId: lab.id,
        },
      })
      const task = await prisma.experimentTask.create({
        data: {
          taskNo: `${PREFIX}${orderNo}-E${String(ei).padStart(2, "0")}`,
          projectId: project.id,
          sampleId: sample.id,
          experimentType: projectType,
          runMethod: projectType,
          suspensionType: suspensionOf(r["细胞/细胞核"]),
          status: ExperimentTaskStatus.completed,
          operatorId: lab.id,
          sequencingAmount: num(r["测序量（G）"]),
          capturedCells: num(r["捕获细胞数"]),
          medianGenes: num(r["基因中位数"]),
        },
      })
      const viability = num(r["活率%"])
      const { qcResult, riskLevel } = qcOf(viability)
      await prisma.qcRecord.create({
        data: {
          sampleId: sample.id,
          taskId: task.id,
          concentration: num(r["悬液浓度(个/ul)"]),
          viability,
          aggregationRate: num(r["结团率%"]),
          qcResult,
          riskLevel,
          createdBy: lab.id,
        },
      })
    }
    pi++
  }

  console.log(`[seed-experience] demo 经验数据：${groups.size} 项目 / ${si} 样本上机`)
}
