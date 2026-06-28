import { z } from "zod"
import {
  ReceiveStatus,
  SampleBatchStatus,
  type ReceiveStatus as ReceiveStatusValue,
  type SampleBatchStatus as SampleBatchStatusValue,
} from "@/lib/enums"
import {
  nullableDate,
  nullableNonNegativeInt,
  nullableString,
  optionalString,
} from "@/lib/schemas/common"
import { compareDateOnly } from "@/lib/utils"

// 注：2026-06 重构后「样本」域操作的是 SampleBatch（样本批次/YP）；样本叶子(Sample) 由收样按数量生成、
// 经实验/多模态补样本名与 QC/产出。本文件的 schema 均为批次级。
const batchStatusValues = Object.values(SampleBatchStatus) as [
  SampleBatchStatusValue,
  ...SampleBatchStatusValue[],
]
const receiveStatusValues = Object.values(ReceiveStatus) as [
  ReceiveStatusValue,
  ...ReceiveStatusValue[],
]

export const sampleBatchStatusSchema = z.enum(batchStatusValues)
export const receiveStatusSchema = z.enum(receiveStatusValues)

/** 样本数量：必填正整数（收样时实物在手、数量已知）；堵 0 叶子空洞（重构 §5） */
const positiveIntCount = z.preprocess(
  (value) => (typeof value === "string" ? Number(value) : value),
  z.number("样本数量必须为数字").int("样本数量必须为整数").positive("样本数量至少为 1")
)

// 批次字段（建项目/收样前进度式收集，均可空）
const batchBaseFields = {
  batchNo: nullableString,
  species: nullableString,
  tissueType: nullableString,
  sampleCount: nullableNonNegativeInt,
  experimentType: nullableString,
  transportCondition: nullableString,
  samplingDate: nullableDate,
  expectedArrivalDate: nullableDate,
  remark: nullableString,
}

/** 预计到样日期不能早于客户取样日期，按自然日比较、同日通过（规格 §8.6） */
function checkArrivalNotBeforeSampling(
  value: { samplingDate?: Date | null; expectedArrivalDate?: Date | null },
  ctx: z.RefinementCtx
) {
  if (compareDateOnly(value.expectedArrivalDate, value.samplingDate) === -1) {
    ctx.addIssue({
      code: "custom",
      path: ["expectedArrivalDate"],
      message: "预计到样日期不能早于客户取样日期",
    })
  }
}

export const createSampleSchema = z
  .object({
    projectId: z.string().trim().min(1, "请选择所属项目"),
    ...batchBaseFields,
  })
  .superRefine(checkArrivalNotBeforeSampling)
export type CreateSampleInput = z.infer<typeof createSampleSchema>

// 更新不含 projectId（批次不支持跨项目移动）、不含接收/状态字段（只能走 receive 动作）
export const updateSampleSchema = z
  .object(batchBaseFields)
  .partial()
  .superRefine(checkArrivalNotBeforeSampling)
  .refine(
    (value) => Object.keys(value).some((key) => value[key as keyof typeof value] !== undefined),
    { message: "至少提供一个要更新的字段" }
  )
export type UpdateSampleInput = z.infer<typeof updateSampleSchema>

// 登记接收 = 录批次编号(YP) + 补全批次信息 + 记录到样；数量必填 ≥1（据此生成样本叶子）
export const receiveSampleSchema = z
  .object({
    batchNo: nullableString,
    species: nullableString,
    tissueType: nullableString,
    experimentType: nullableString,
    transportCondition: nullableString,
    sampleCount: positiveIntCount,
    receivedAt: nullableDate,
    receiveStatus: receiveStatusSchema.default(ReceiveStatus.normal),
    abnormalNote: nullableString,
  })
  .superRefine((value, ctx) => {
    if (value.receiveStatus === ReceiveStatus.abnormal && !value.abnormalNote) {
      ctx.addIssue({
        code: "custom",
        path: ["abnormalNote"],
        message: "异常接收必须填写异常说明",
      })
    }
  })
export type ReceiveSampleInput = z.infer<typeof receiveSampleSchema>

export const markSampleAbnormalSchema = z.object({
  reason: z.string().trim().min(1, "请输入异常原因").max(1000, "异常原因最多 1000 字"),
})
export type MarkSampleAbnormalInput = z.infer<typeof markSampleAbnormalSchema>

export const sampleListQuerySchema = z.object({
  q: optionalString,
  status: sampleBatchStatusSchema.optional(),
  projectId: optionalString,
  /** received=1：已接收（receivedAt 非空），收样工位「已接收」入口 */
  received: z.enum(["1"]).optional(),
  page: optionalString,
  limit: optionalString,
})
export type SampleListQuery = z.infer<typeof sampleListQuerySchema>
