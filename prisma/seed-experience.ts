import * as XLSX from "xlsx"
import prisma from "../lib/prisma"
import {
  BioinfoTaskStatus,
  ExperimentTaskStatus,
  ProjectStatus,
  QCResult,
  RiskLevel,
  ResultStatus,
  SampleBatchStatus,
  SampleStatus,
  ServiceLevel,
  SuspensionType,
  UserRole,
  type BioinfoTaskStatus as BioinfoTaskStatusValue,
  type ExperimentTaskStatus as ExperimentTaskStatusValue,
  type ProjectStatus as ProjectStatusValue,
  type SampleStatus as SampleStatusValue,
  type ServiceLevel as ServiceLevelValue,
} from "../lib/enums"

/**
 * Demo 业务数据 seed（重构 §2.6）：把对齐版样例灌成真实业务项目，供演示。
 * - **完成锚点**：data/拜谱单细胞实验预约.xlsx 的 3 个委托单 → 真实业务字段的「已完成」项目
 *   + 样本批次；再把 data/单细胞项目经验.xlsx 的产出（一行一捕获）按「委托单号 + 样本名」
 *   挂到对应样本叶子（产出指标 + QC + 已完成上机任务）→ 喂经验库（相似检索 + 图表）。
 *   不再造独立 DEMO- 壳：项目即业务项目、用真实委托单号。
 * - **在途集**：再补一小批跨流程阶段的演示项目（草稿 / 待收样 / 待预约实验 / 实验中 /
 *   待分配生信 / 生信中 / 待交付 / 异常），让工位队列与侧栏角标非空，可视化工位制。
 * 幂等：每次先清掉本 seed 造的项目（按已知委托单号 + 在途编号 + remark 哨兵）再重建。
 * SEED_DEMO=0 可跳过（正式部署不灌 demo）。
 */

const BOOKING_XLSX = "data/拜谱单细胞实验预约.xlsx"
const EXPERIENCE_XLSX = "data/单细胞项目经验.xlsx"
const DEMO_SENTINEL = "DEMO_SEED" // 标记无委托单号的草稿，便于幂等清理

function str(v: unknown): string | null {
  const s = String(v ?? "").trim()
  return s || null
}
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}
function intNum(v: unknown): number | null {
  const n = num(v)
  return n == null ? null : Math.round(n)
}
function suspensionOf(v: unknown): SuspensionType | null {
  const s = String(v ?? "")
  if (s.includes("核")) return SuspensionType.nucleus
  if (s.includes("细胞")) return SuspensionType.cell
  return null
}
function qcOf(viability: number | null): { qcResult: QCResult; riskLevel: RiskLevel } {
  if (viability == null || viability >= 85) return { qcResult: QCResult.passed, riskLevel: RiskLevel.normal }
  if (viability >= 70) return { qcResult: QCResult.low_risk_passed, riskLevel: RiskLevel.low_risk }
  return { qcResult: QCResult.failed, riskLevel: RiskLevel.high_risk }
}
/** Excel 序列号 / 日期串 → Date（序列号基准 1899-12-30，含时分小数） */
function asDate(v: unknown): Date | null {
  if (v == null || v === "") return null
  if (v instanceof Date) return v
  const n = Number(v)
  if (!Number.isNaN(n)) return new Date(Math.round((n - 25569) * 86400 * 1000))
  const d = new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d
}
function platformOf(runMethod: string | null): string | null {
  const s = runMethod ?? ""
  if (/10x/i.test(s)) return "10X Genomics"
  return null
}
function daysFromNow(n: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + n)
  return d
}

function readSheet(file: string): Record<string, unknown>[] {
  const wb = XLSX.readFile(file)
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null })
}

// —— 在途演示集：覆盖各工位队列与侧栏角标 ——
type InFlightSpec = {
  no: string | null
  status: ProjectStatusValue
  service: ServiceLevelValue
  batch: "none" | "waiting" | "received"
  batchInfo?: "prefilled" | "blank"
  leaves?: number
  leafStatus?: SampleStatusValue
  task?: ExperimentTaskStatusValue
  bioinfo?: BioinfoTaskStatusValue
  bioinfoAssignee?: "assigned" | "unassigned"
  statusBefore?: ProjectStatusValue
}
const INFLIGHT_SPECS: InFlightSpec[] = [
  // 草稿（未编号）→ 项目「需关注」；未确认前不放进收样演示队列
  { no: null, status: ProjectStatus.draft, service: ServiceLevel.standard, batch: "none" },
  // 待收样（已预填批次信息）→ 收样队列：打开「登记接收」应直接核对
  {
    no: "BP-G260601001",
    status: ProjectStatus.waiting_sample,
    service: ServiceLevel.qc,
    batch: "waiting",
    batchInfo: "prefilled",
  },
  // 待收样（批次信息缺失）→ 收样队列：打开「登记接收」需要补录
  {
    no: "BP-G260601007",
    status: ProjectStatus.waiting_sample,
    service: ServiceLevel.standard,
    batch: "waiting",
    batchInfo: "blank",
  },
  // 待预约实验：样本已接收、尚未创建实验任务 → 实验工位主列表显示「预约实验」
  {
    no: "BP-G260601008",
    status: ProjectStatus.sample_received,
    service: ServiceLevel.standard,
    batch: "received",
    leaves: 2,
    leafStatus: SampleStatus.received,
  },
  // 实验进行中 → 实验队列
  {
    no: "BP-G260601002",
    status: ProjectStatus.lab_in_progress,
    service: ServiceLevel.standard,
    batch: "received",
    leaves: 3,
    leafStatus: SampleStatus.lab_in_progress,
    task: ExperimentTaskStatus.in_progress,
  },
  // 待分配生信：实验反馈完成后已自动生成生信任务，但实验人员未指定分析员
  {
    no: "BP-G260601003",
    status: ProjectStatus.waiting_bioinfo,
    service: ServiceLevel.advanced,
    batch: "received",
    leaves: 2,
    leafStatus: SampleStatus.feedback_submitted,
    task: ExperimentTaskStatus.completed,
    bioinfo: BioinfoTaskStatus.pending,
    bioinfoAssignee: "unassigned",
  },
  // 生信进行中（已分配示例生信）→ 生信工位「分析负责人」菜单可命中
  {
    no: "BP-G260601004",
    status: ProjectStatus.bioinfo_in_progress,
    service: ServiceLevel.advanced,
    batch: "received",
    leaves: 2,
    leafStatus: SampleStatus.feedback_submitted,
    task: ExperimentTaskStatus.completed,
    bioinfo: BioinfoTaskStatus.in_progress,
    bioinfoAssignee: "assigned",
  },
  // 非生信服务：实验完成后直接待交付 → 项目「需关注」
  {
    no: "BP-G260601005",
    status: ProjectStatus.waiting_delivery,
    service: ServiceLevel.run,
    batch: "received",
    leaves: 2,
    leafStatus: SampleStatus.feedback_submitted,
    task: ExperimentTaskStatus.completed,
  },
  // 异常 → 项目「需关注」
  {
    no: "BP-G260601006",
    status: ProjectStatus.abnormal,
    service: ServiceLevel.standard,
    batch: "received",
    leaves: 1,
    leafStatus: SampleStatus.received,
    statusBefore: ProjectStatus.lab_in_progress,
  },
]

export async function seedDemoData() {
  if (process.env.SEED_DEMO === "0") {
    console.log("[seed-demo] SEED_DEMO=0，跳过 demo 数据")
    return
  }

  let booking: Record<string, unknown>[]
  let experience: Record<string, unknown>[]
  try {
    booking = readSheet(BOOKING_XLSX)
    experience = readSheet(EXPERIENCE_XLSX)
  } catch (e) {
    console.warn(`[seed-demo] 读样例失败，跳过：`, (e as Error).message)
    return
  }

  const [sales, pm, receiver, lab, bioinfo] = await Promise.all([
    prisma.user.findFirst({ where: { role: UserRole.sales_owner }, select: { id: true } }),
    prisma.user.findFirst({ where: { role: UserRole.project_manager }, select: { id: true } }),
    prisma.user.findFirst({ where: { role: UserRole.sample_receiver }, select: { id: true } }),
    prisma.user.findFirst({ where: { role: UserRole.lab_operator }, select: { id: true } }),
    prisma.user.findFirst({ where: { role: UserRole.bioinfo_analyst }, select: { id: true } }),
  ])
  if (!sales || !pm || !receiver || !lab || !bioinfo) {
    console.warn("[seed-demo] 缺角色用户（sales/pm/receiver/lab/bioinfo），跳过")
    return
  }

  // 经验产出按委托单分组（项目编号 = 委托单号）
  const expByOrder = new Map<string, Record<string, unknown>[]>()
  for (const r of experience) {
    const k = str(r["项目编号"])
    if (!k) continue
    if (!expByOrder.has(k)) expByOrder.set(k, [])
    expByOrder.get(k)!.push(r)
  }

  const bookingOrderNos = booking.map((b) => str(b["项目编号"])).filter((x): x is string => !!x)
  const inflightNos = INFLIGHT_SPECS.map((s) => s.no).filter((x): x is string => !!x)
  const demoNos = [...bookingOrderNos, ...inflightNos]

  await cleanupDemo(demoNos)

  // —— 完成锚点：预约表委托单 → 已完成业务项目 + 经验挂叶子 ——
  let leafTotal = 0
  for (const b of booking) {
    const orderNo = str(b["项目编号"])
    if (!orderNo) continue
    const runMethod = str(b["上机方式"])
    const receivedAt = asDate(b["样本接收日期"]) ?? asDate(b["预计到样日期"])
    const labDate = asDate(b["实验日期"]) ?? receivedAt ?? daysFromNow(-30)
    const species0 = str(b["样本物种"])
    const tissue0 = str(b["样本组织类型"])
    const expType = str(b["实验类型"]) ?? "单细胞转录组"

    const project = await prisma.project.create({
      data: {
        projectNo: orderNo,
        contractNo: str(b["合同编号*"]),
        customerOrg: str(b["客户单位"]) ?? "示例客户",
        customerName: str(b["客户姓名"]) ?? "示例",
        projectType: str(b["上机方式"]) ?? expType,
        serviceItems: runMethod ?? expType,
        serviceLevel: ServiceLevel.standard, // 锚点含完整产出，按完整分析路径
        sequencingPlatform: platformOf(runMethod),
        priority: "普通",
        status: ProjectStatus.completed,
        expectedDeliveryDate: labDate,
        deliveredAt: labDate,
        salesOwnerId: sales.id,
        projectManagerId: pm.id,
      },
    })

    const grp = expByOrder.get(orderNo) ?? []
    const batch = await prisma.sampleBatch.create({
      data: {
        projectId: project.id,
        batchNo: str(b["样品编号"]),
        seq: 1,
        sampleCount: intNum(b["样本数量"]) ?? grp.length,
        species: species0,
        tissueType: tissue0,
        experimentType: expType,
        transportCondition: str(b["运输条件"]),
        samplingDate: asDate(b["客户取样日期"]),
        expectedArrivalDate: asDate(b["预计到样日期"]),
        receivedAt,
        status: SampleBatchStatus.received,
        receiverId: receiver.id,
      },
    })

    // 多对多落地：每行一捕获 = 每叶子 1 条样本 + 1 条 qc，但实验任务按批次共享 1 个（一次上机多样品）。
    // 原写法是「每叶子 1 task」，与现实业务粒度不符；改为：先批量建 leaves + 收集 sampleIds，再 createMany TaskSample 一次性挂到 1 个 task。
    const bookingLeaves: {
      sampleId: string
      viability: number | null
      qcResult: QCResult
      riskLevel: RiskLevel
      concentration: number | null
      aggregationRate: number | null
    }[] = []
    for (const r of grp) {
      leafTotal++
      const viability = num(r["活率%"])
      const { qcResult, riskLevel } = qcOf(viability)
      const sample = await prisma.sample.create({
        data: {
          batchId: batch.id,
          projectId: project.id,
          sampleName: str(r["样本名"]),
          species: str(r["物种"]) ?? species0,
          tissueType: str(r["部位"]) ?? tissue0,
          status: SampleStatus.feedback_submitted,
          suspensionType: suspensionOf(r["细胞/细胞核"]),
          sequencingAmount: num(r["测序量（G）"]),
          capturedCells: intNum(r["捕获细胞数"]),
          medianGenes: intNum(r["基因中位数"]),
        },
      })
      bookingLeaves.push({
        sampleId: sample.id,
        viability,
        qcResult,
        riskLevel,
        concentration: num(r["悬液浓度(个/ul)"]),
        aggregationRate: num(r["结团率%"]),
      })
    }

    if (bookingLeaves.length > 0) {
      const task = await prisma.experimentTask.create({
        data: {
          taskNo: `${orderNo}-E01`,
          projectId: project.id,
          experimentType: expType,
          runMethod: expType,
          status: ExperimentTaskStatus.completed,
          actualDate: labDate,
          resultStatus: ResultStatus.normal_run,
          resultFeedback: "历史项目 seed：实验反馈已提交",
          operatorId: lab.id,
          // 多对多：createMany 把整批次叶子一次性挂到同一次上机（TaskSample 表）
          taskSamples: {
            create: bookingLeaves.map((leaf) => ({ sampleId: leaf.sampleId })),
          },
        },
      })
      for (const leaf of bookingLeaves) {
        await prisma.qcRecord.create({
          data: {
            sampleId: leaf.sampleId,
            taskId: task.id,
            source: "manual",
            concentration: leaf.concentration,
            viability: leaf.viability,
            aggregationRate: leaf.aggregationRate,
            qcResult: leaf.qcResult,
            riskLevel: leaf.riskLevel,
            createdBy: lab.id,
          },
        })
      }

      await prisma.bioinfoTask.create({
        data: {
          taskNo: `${orderNo}-B01`,
          projectId: project.id,
          experimentTaskId: task.id,
          analysisType: "标准分析",
          dataReceivedAt: labDate,
          analystId: bioinfo.id,
          status: BioinfoTaskStatus.delivered,
          deliveredAt: labDate,
          deliverableNote: "历史项目 seed：报告与矩阵文件已交付",
        },
      })
    }
  }

  // —— 在途集：跨阶段，喂工位队列 / 角标 ——
  for (let i = 0; i < INFLIGHT_SPECS.length; i++) {
    await createInFlight(INFLIGHT_SPECS[i], booking[i % booking.length], {
      salesId: sales.id,
      pmId: pm.id,
      receiverId: receiver.id,
      labId: lab.id,
      bioinfoId: bioinfo.id,
    })
  }

  console.log(
    `[seed-demo] 完成锚点 ${bookingOrderNos.length} 项目 / ${leafTotal} 样本叶子（一行一捕获）` +
      ` + 在途演示 ${INFLIGHT_SPECS.length} 项目`
  )
}

async function createInFlight(
  spec: InFlightSpec,
  b: Record<string, unknown>,
  users: { salesId: string; pmId: string; receiverId: string; labId: string; bioinfoId: string }
) {
  const species = str(b?.["样本物种"]) ?? "人"
  const tissue = str(b?.["样本组织类型"]) ?? "组织"
  const expType = str(b?.["实验类型"]) ?? "组织解离"
  const runMethod = str(b?.["上机方式"]) ?? expType
  const blankBatchInfo = spec.batchInfo === "blank" && spec.batch === "waiting"

  const project = await prisma.project.create({
    data: {
      projectNo: spec.no,
      contractNo: str(b?.["合同编号*"]),
      customerOrg: str(b?.["客户单位"]) ?? "示例客户",
      customerName: str(b?.["客户姓名"]) ?? "示例",
      projectType: runMethod,
      serviceItems: runMethod,
      serviceLevel: spec.service,
      sequencingPlatform: platformOf(runMethod),
      priority: "普通",
      status: spec.status,
      statusBeforeAbnormal: spec.statusBefore ?? null,
      expectedDeliveryDate: daysFromNow(14),
      salesOwnerId: users.salesId,
      projectManagerId: users.pmId,
      remark: spec.no ? null : DEMO_SENTINEL, // 无委托单号草稿用哨兵保证幂等可清
    },
  })

  if (spec.batch === "none") return

  const received = spec.batch === "received"
  const batch = await prisma.sampleBatch.create({
    data: {
      projectId: project.id,
      batchNo: received ? `YP2026060${Math.floor(1000 + Math.abs(hashNo(spec.no)) % 9000)}` : null,
      seq: 1,
      sampleCount: blankBatchInfo ? null : (spec.leaves ?? intNum(b?.["样本数量"]) ?? 1),
      species: blankBatchInfo ? null : species,
      tissueType: blankBatchInfo ? null : tissue,
      experimentType: blankBatchInfo ? null : expType,
      transportCondition: blankBatchInfo ? null : (str(b?.["运输条件"]) ?? "4度"),
      expectedArrivalDate: daysFromNow(received ? -5 : 3),
      receivedAt: received ? daysFromNow(-3) : null,
      status: received ? SampleBatchStatus.received : SampleBatchStatus.waiting_arrival,
      receiverId: received ? users.receiverId : null,
    },
  })

  if (!received || !spec.leaves) return

  const sampleIds: string[] = []
  for (let i = 0; i < spec.leaves; i++) {
    const sample = await prisma.sample.create({
      data: {
        batchId: batch.id,
        projectId: project.id,
        sampleName: `S${i + 1}`,
        species,
        tissueType: tissue,
        status: spec.leafStatus ?? SampleStatus.received,
      },
    })
    sampleIds.push(sample.id)
  }

  if (!spec.task) return
  const task = await prisma.experimentTask.create({
    data: {
      taskNo: `${spec.no}-E01`,
      projectId: project.id,
      experimentType: expType,
      runMethod,
      status: spec.task,
      plannedDate: daysFromNow(-2),
      actualDate: spec.task === ExperimentTaskStatus.completed ? daysFromNow(-1) : null,
      resultStatus: spec.task === ExperimentTaskStatus.completed ? ResultStatus.normal_run : null,
      resultFeedback: spec.task === ExperimentTaskStatus.completed ? "seed 演示数据：实验反馈已提交" : null,
      operatorId: users.labId,
      taskSamples: { create: sampleIds.map((sampleId) => ({ sampleId })) },
    },
  })

  if (!spec.bioinfo) return
  await prisma.bioinfoTask.create({
    data: {
      taskNo: `${spec.no}-B01`,
      projectId: project.id,
      experimentTaskId: task.id,
      analysisType: "标准分析",
      dataReceivedAt: daysFromNow(-1),
      status: spec.bioinfo,
      // 不变量（ADR-0004）：仅 pending 可未分配；其余状态一律给负责人，避免演示数据造出「分析中+未分配」
      analystId:
        spec.bioinfo === BioinfoTaskStatus.pending && spec.bioinfoAssignee === "unassigned"
          ? null
          : users.bioinfoId,
    },
  })
}

function hashNo(no: string | null): number {
  let h = 0
  for (const ch of no ?? "x") h = (h * 31 + ch.charCodeAt(0)) | 0
  return h
}

/** 删除本 seed 造的 demo 项目及其全部子实体（按 FK 顺序），用于幂等重建。 */
async function cleanupDemo(projectNos: string[]) {
  const projects = await prisma.project.findMany({
    where: { OR: [{ projectNo: { in: projectNos } }, { remark: DEMO_SENTINEL }] },
    select: { id: true },
  })
  const ids = projects.map((p) => p.id)
  if (!ids.length) return

  const [tasks, samples, batches] = await Promise.all([
    prisma.experimentTask.findMany({ where: { projectId: { in: ids } }, select: { id: true } }),
    prisma.sample.findMany({ where: { projectId: { in: ids } }, select: { id: true } }),
    prisma.sampleBatch.findMany({ where: { projectId: { in: ids } }, select: { id: true } }),
  ])
  await prisma.qcRecord.deleteMany({ where: { sampleId: { in: samples.map((s) => s.id) } } })
  await prisma.bioinfoTask.deleteMany({ where: { projectId: { in: ids } } })
  await prisma.experimentRecordImage.deleteMany({
    where: {
      OR: [{ projectId: { in: ids } }, { taskId: { in: tasks.map((t) => t.id) } }],
    },
  })
  await prisma.operationLog.deleteMany({
    where: {
      entityId: {
        in: [...ids, ...tasks.map((t) => t.id), ...samples.map((s) => s.id), ...batches.map((b) => b.id)],
      },
    },
  })
  await prisma.experimentTask.deleteMany({ where: { projectId: { in: ids } } })
  await prisma.sample.deleteMany({ where: { projectId: { in: ids } } })
  await prisma.sampleBatch.deleteMany({ where: { projectId: { in: ids } } })
  await prisma.project.deleteMany({ where: { id: { in: ids } } })
}
