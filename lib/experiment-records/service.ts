import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { recordOperation } from "@/lib/operation-log"
import {
  buildExperimentTaskScope,
  buildProjectScope,
} from "@/lib/auth/role-scope"
import {
  DataSource,
  ExperimentTaskStatus,
  OcrStatus,
  OperationAction,
  QCResult,
  RiskLevel,
  type ExperimentTaskStatus as ExperimentTaskStatusValue,
  type UserRole as UserRoleValue,
} from "@/lib/enums"
import { experimentManageRoles } from "@/lib/experiment-tasks/rules"
import {
  isSupportedImageType,
  mimeForKey,
  readRecordImage,
  saveRecordImage,
} from "@/lib/storage/local"
import { isMultimodalEnabled, OCR_MODEL_ID } from "@/lib/ai/ocr-provider"
import { recognizeExperimentImage } from "@/lib/ai/recognize-experiment-image"
import type { OcrResult, OcrRow } from "@/lib/ai/ocr-schema"
import type { ConfirmRecordImageInput } from "@/lib/schemas/experiment-record"

export type RecordOperator = { id: string; role?: UserRoleValue }

export class ExperimentRecordError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export function handleExperimentRecordError(error: unknown) {
  if (error instanceof ExperimentRecordError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  return null
}

// 上机后方可上传实验记录
const UPLOADABLE_STATUSES: ExperimentTaskStatusValue[] = [
  ExperimentTaskStatus.in_progress,
  ExperimentTaskStatus.waiting_feedback,
  ExperimentTaskStatus.completed,
]
const MAX_BYTES = 10 * 1024 * 1024 // 单图 ≤10MB（与 MiniMax 上限一致）

function ensureManageRole(role: UserRoleValue | undefined, action: string) {
  if (!role || !experimentManageRoles.includes(role as (typeof experimentManageRoles)[number])) {
    throw new ExperimentRecordError(`没有${action}权限`, 403)
  }
}

/** 按活率派生质控结论/风险（人工可在确认时覆盖）；与 seed 口径一致 */
function deriveQc(viability: number | null | undefined): { qcResult: QCResult; riskLevel: RiskLevel } {
  if (viability == null || viability >= 85) return { qcResult: QCResult.passed, riskLevel: RiskLevel.normal }
  if (viability >= 70) return { qcResult: QCResult.low_risk_passed, riskLevel: RiskLevel.low_risk }
  return { qcResult: QCResult.failed, riskLevel: RiskLevel.high_risk }
}

const taskLeafWhere = (operator: RecordOperator, taskId: string) => ({
  AND: [{ id: taskId }, buildExperimentTaskScope(operator.role, operator.id)],
})

/** 载入任务（在操作者可见范围内）+ 其样本叶子，作为对齐候选 */
async function loadTaskInScope(operator: RecordOperator, taskId: string) {
  const task = await prisma.experimentTask.findFirst({
    where: taskLeafWhere(operator, taskId),
    select: {
      id: true,
      projectId: true,
      taskNo: true,
      status: true,
      taskSamples: {
        include: { sample: { select: { id: true, sampleName: true, batch: { select: { batchNo: true } } } } },
      },
    },
  })
  if (!task) throw new ExperimentRecordError("实验任务不存在或无权访问", 404)
  const leaves = task.taskSamples.map((ts) => ts.sample)
  return { task, leaves }
}

type AlignLeaf = { id: string; sampleName: string | null; batch: { batchNo: string | null } }

/** 为识别行预绑定候选叶子：先按样本名精确匹配，未命中回退行序，已被占用的不重复绑 */
function suggestBindings(rows: OcrRow[], leaves: AlignLeaf[]) {
  const used = new Set<string>()
  return rows.map((row, i) => {
    let sampleId: string | null = null
    const name = row.sampleName?.trim()
    if (name) {
      const exact = leaves.find((l) => l.sampleName?.trim() === name && !used.has(l.id))
      if (exact) sampleId = exact.id
    }
    if (!sampleId) {
      const byOrder = leaves[i]
      if (byOrder && !used.has(byOrder.id)) sampleId = byOrder.id
    }
    if (sampleId) used.add(sampleId)
    return { ...row, suggestedSampleId: sampleId }
  })
}

function alignmentPayload(
  image: { id: string; taskId: string; projectId: string; ocrStatus: string; ocrError: string | null; ocrModel: string | null; confirmedAt: Date | null; uploadedAt: Date },
  rows: OcrRow[],
  leaves: AlignLeaf[]
) {
  return {
    image,
    rows: suggestBindings(rows, leaves),
    leaves: leaves.map((l) => ({ id: l.id, sampleName: l.sampleName, batchNo: l.batch.batchNo })),
  }
}

/**
 * 上传实验记录图片：存证到本地磁盘 + 建记录 + 内联多模态识别（HITL 仅预填、不落库）。
 * 识别失败/未启用不阻断——落 ocrStatus=failed/pending，回退人工录入。
 */
export async function uploadRecordImage(
  operator: RecordOperator,
  taskId: string,
  file: { bytes: Buffer; mediaType: string }
) {
  ensureManageRole(operator.role, "上传实验记录")
  if (!isSupportedImageType(file.mediaType)) {
    throw new ExperimentRecordError("仅支持 JPEG/PNG/WEBP/GIF 图片", 415)
  }
  if (file.bytes.byteLength > MAX_BYTES) {
    throw new ExperimentRecordError("图片超过 10MB，请压缩后再上传", 413)
  }
  const { task, leaves } = await loadTaskInScope(operator, taskId)
  if (!UPLOADABLE_STATUSES.includes(task.status as ExperimentTaskStatusValue)) {
    throw new ExperimentRecordError("仅上机后（进行中/待反馈/已完成）的任务可上传实验记录", 409)
  }

  const enabled = isMultimodalEnabled()
  const created = await prisma.$transaction(async (tx) => {
    const image = await tx.experimentRecordImage.create({
      data: {
        projectId: task.projectId,
        taskId: task.id,
        storageKey: "", // 占位，落盘后回填（用 id 命名）
        uploadedById: operator.id,
        ocrStatus: enabled ? OcrStatus.processing : OcrStatus.pending,
        ocrModel: enabled ? OCR_MODEL_ID : null,
      },
    })
    const key = await saveRecordImage(image.id, file.mediaType, file.bytes)
    const withKey = await tx.experimentRecordImage.update({
      where: { id: image.id },
      data: { storageKey: key },
    })
    await recordOperation({
      tx,
      entityType: "experiment_record_image",
      entityId: image.id,
      action: OperationAction.create,
      operatorId: operator.id,
      after: { taskId: task.id, ocrStatus: withKey.ocrStatus, kind: "record_image" },
    })
    return withKey
  })

  let image = created
  if (enabled) {
    try {
      const result: OcrResult = await recognizeExperimentImage(
        new Uint8Array(file.bytes),
        file.mediaType
      )
      image = await prisma.experimentRecordImage.update({
        where: { id: created.id },
        data: { ocrStatus: OcrStatus.done, ocrResult: result, ocrError: null },
      })
    } catch (error) {
      image = await prisma.experimentRecordImage.update({
        where: { id: created.id },
        data: { ocrStatus: OcrStatus.failed, ocrError: (error as Error).message.slice(0, 500) },
      })
    }
  }

  const rows = (image.ocrResult as OcrResult | null)?.rows ?? []
  return alignmentPayload(image, rows, leaves)
}

/** 重新打开对齐：取识别结果 + 候选叶子（确认前/重新确认用） */
export async function getRecordImageAlignment(operator: RecordOperator, imageId: string) {
  const image = await prisma.experimentRecordImage.findFirst({
    where: { AND: [{ id: imageId }, { project: buildProjectScope(operator.role, operator.id) }] },
  })
  if (!image) throw new ExperimentRecordError("识别记录不存在或无权访问", 404)
  const { leaves } = await loadTaskInScope(operator, image.taskId)
  const rows = (image.ocrResult as OcrResult | null)?.rows ?? []
  return alignmentPayload(image, rows, leaves)
}

/** 鉴权代理读原图：校验操作者在该图所属项目 scope 内 → 返回字节流 */
export async function readRecordImageFile(operator: RecordOperator, imageId: string) {
  const image = await prisma.experimentRecordImage.findFirst({
    where: { AND: [{ id: imageId }, { project: buildProjectScope(operator.role, operator.id) }] },
    select: { storageKey: true },
  })
  if (!image) throw new ExperimentRecordError("识别记录不存在或无权访问", 404)
  const bytes = await readRecordImage(image.storageKey)
  return { bytes, mediaType: mimeForKey(image.storageKey) }
}

/**
 * 人工确认写回（HITL，重构 §6 step5/§9 幂等）：成对写 Sample.sampleName + QcRecord(source=ai_confirmed)。
 * 每行须绑定唯一且 ∈ 该 task 叶子；二次确认须 reconfirm，先删本图旧贡献再写（幂等）。
 */
export async function confirmRecordImage(
  operator: RecordOperator,
  imageId: string,
  input: ConfirmRecordImageInput
) {
  ensureManageRole(operator.role, "确认实验记录")
  const image = await prisma.experimentRecordImage.findFirst({
    where: { AND: [{ id: imageId }, { project: buildProjectScope(operator.role, operator.id) }] },
  })
  if (!image) throw new ExperimentRecordError("识别记录不存在或无权访问", 404)
  if (image.confirmedAt && !input.reconfirm) {
    throw new ExperimentRecordError("该记录已确认，如需修改请发起重新确认", 409)
  }

  const { task, leaves } = await loadTaskInScope(operator, image.taskId)
  const validLeafIds = new Set(leaves.map((l) => l.id))
  const seen = new Set<string>()
  for (const row of input.rows) {
    if (!validLeafIds.has(row.sampleId)) {
      throw new ExperimentRecordError("存在指派到非本任务样本的行", 422)
    }
    if (seen.has(row.sampleId)) {
      throw new ExperimentRecordError("多行指派到了同一个样本叶子", 422)
    }
    seen.add(row.sampleId)
  }

  const updated = await prisma.$transaction(async (tx) => {
    // 重新确认：先删本图旧 QC 贡献，幂等
    if (image.confirmedAt) {
      await tx.qcRecord.deleteMany({ where: { recordImageId: imageId } })
    }
    for (const row of input.rows) {
      if (row.sampleName != null) {
        await tx.sample.update({ where: { id: row.sampleId }, data: { sampleName: row.sampleName } })
      }
      const derived = deriveQc(row.viability)
      await tx.qcRecord.create({
        data: {
          sampleId: row.sampleId,
          taskId: task.id,
          concentration: row.concentration ?? null,
          viability: row.viability ?? null,
          aggregationRate: row.aggregationRate ?? null,
          // zod 已校验取值合法，转回枚举类型
          qcResult: (row.qcResult as QCResult | undefined) ?? derived.qcResult,
          riskLevel: (row.riskLevel as RiskLevel | undefined) ?? derived.riskLevel,
          source: DataSource.ai_confirmed,
          recordImageId: imageId,
          createdBy: operator.id,
        },
      })
    }
    const img = await tx.experimentRecordImage.update({
      where: { id: imageId },
      data: { confirmedById: operator.id, confirmedAt: new Date() },
    })
    await recordOperation({
      tx,
      entityType: "experiment_record_image",
      entityId: imageId,
      action: OperationAction.update,
      operatorId: operator.id,
      after: {
        kind: "record_image_confirm",
        reconfirm: Boolean(image.confirmedAt),
        rows: input.rows.map((r) => ({ sampleId: r.sampleId, sampleName: r.sampleName, viability: r.viability })),
      },
    })
    return img
  })

  return { image: updated, confirmed: input.rows.length }
}
