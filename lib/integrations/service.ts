import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { recordOperation } from "@/lib/operation-log"
import { OperationAction, UserRole } from "@/lib/enums"
import type { ReportRunMetricsInput, RunMetricsItemInput } from "@/lib/schemas/integration"

export class IntegrationError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export function handleIntegrationError(error: unknown) {
  if (error instanceof IntegrationError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  return null
}

// 服务账号：机对机写入的 operator（operation_logs.operator_id NOT NULL 需真实 User 行）。
// isActive=false + 非法密码哈希 → 永不可经 Credentials 登录；按需 upsert，免 seed 依赖。
const SERVICE_ACCOUNT = {
  username: "integration-bot",
  email: "integration-bot@system.local",
  name: "生信集成服务",
  role: UserRole.bioinfo_analyst,
} as const

/** 取（必要时建）集成服务账号，返回其 user id */
export async function getIntegrationServiceAccount(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { username: SERVICE_ACCOUNT.username },
    update: {},
    create: { ...SERVICE_ACCOUNT, password: "!integration-no-login", isActive: false },
    select: { id: true },
  })
  return user.id
}

const metricsSelect = {
  suspensionType: true,
  sequencingAmount: true,
  capturedCells: true,
  medianGenes: true,
} as const

type ItemStatus = "updated" | "project_not_found" | "sample_not_found" | "ambiguous"
export type RunMetricsItemResult = {
  projectNo: string
  sampleName: string
  status: ItemStatus
  sampleId?: string
}

/** 取本条上报中明确给出的产出字段（undefined 跳过、null 表示订正清空，与 recordRunMetrics 同口径） */
function pickMetrics(item: RunMetricsItemInput): Prisma.SampleUpdateInput {
  return Object.fromEntries(
    Object.entries({
      suspensionType: item.suspensionType,
      sequencingAmount: item.sequencingAmount,
      capturedCells: item.capturedCells,
      medianGenes: item.medianGenes,
    }).filter(([, v]) => v !== undefined)
  ) as Prisma.SampleUpdateInput
}

/**
 * 机对机写产出（重构 §6.5）：逐条按 projectNo+sampleName 定位样本叶子、写产出字段。
 * 部分成功可报（一条定位失败不影响其余）；每条单独事务（更新叶子 + 写操作日志）。
 * 幂等：纯字段覆盖，重复上报同值无副作用、订正即覆盖。
 */
export async function reportRunMetrics(
  input: ReportRunMetricsInput
): Promise<{ results: RunMetricsItemResult[]; updated: number }> {
  const operatorId = await getIntegrationServiceAccount()
  const results: RunMetricsItemResult[] = []

  for (const item of input.items) {
    const leaves = await prisma.sample.findMany({
      where: {
        sampleName: item.sampleName,
        batch: { project: { projectNo: item.projectNo } },
      },
      select: { id: true },
    })

    if (leaves.length === 0) {
      const project = await prisma.project.findUnique({
        where: { projectNo: item.projectNo },
        select: { id: true },
      })
      results.push({
        projectNo: item.projectNo,
        sampleName: item.sampleName,
        status: project ? "sample_not_found" : "project_not_found",
      })
      continue
    }
    if (leaves.length > 1) {
      results.push({ projectNo: item.projectNo, sampleName: item.sampleName, status: "ambiguous" })
      continue
    }

    const leafId = leaves[0].id
    const data = pickMetrics(item)
    await prisma.$transaction(async (tx) => {
      const before = await tx.sample.findUnique({ where: { id: leafId }, select: metricsSelect })
      const after = await tx.sample.update({ where: { id: leafId }, data, select: metricsSelect })
      await recordOperation({
        tx,
        entityType: "sample",
        entityId: leafId,
        action: OperationAction.update,
        operatorId,
        before,
        after: { kind: "run_metrics", source: "integration_api", metrics: after },
      })
    })
    results.push({
      projectNo: item.projectNo,
      sampleName: item.sampleName,
      status: "updated",
      sampleId: leafId,
    })
  }

  return { results, updated: results.filter((r) => r.status === "updated").length }
}
