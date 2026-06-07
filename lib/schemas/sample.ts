import { z } from "zod"
import {
  ReceiveStatus,
  SampleStatus,
  type ReceiveStatus as ReceiveStatusValue,
  type SampleStatus as SampleStatusValue,
} from "@/lib/enums"
import {
  nullableDate,
  nullableNonNegativeInt,
  nullableString,
  optionalString,
  requiredString,
} from "@/lib/schemas/common"
import { compareDateOnly } from "@/lib/utils"

const sampleStatusValues = Object.values(SampleStatus) as [
  SampleStatusValue,
  ...SampleStatusValue[],
]
const receiveStatusValues = Object.values(ReceiveStatus) as [
  ReceiveStatusValue,
  ...ReceiveStatusValue[],
]

export const sampleStatusSchema = z.enum(sampleStatusValues)
export const receiveStatusSchema = z.enum(receiveStatusValues)

const sampleBaseFields = {
  sampleNo: requiredString("请输入样品编号"),
  species: requiredString("请输入样本物种"),
  tissueType: requiredString("请输入组织类型"),
  sampleCount: nullableNonNegativeInt,
  experimentType: requiredString("请输入实验类型"),
  transportCondition: requiredString("请输入运输条件"),
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
    projectId: requiredString("请选择所属项目"),
    ...sampleBaseFields,
  })
  .superRefine(checkArrivalNotBeforeSampling)
export type CreateSampleInput = z.infer<typeof createSampleSchema>

// 更新不含 projectId（样本不支持跨项目移动）、不含接收/状态字段（只能走 receive 动作）
export const updateSampleSchema = z
  .object(sampleBaseFields)
  .partial()
  .superRefine(checkArrivalNotBeforeSampling)
  .refine(
    (value) => Object.keys(value).some((key) => value[key as keyof typeof value] !== undefined),
    { message: "至少提供一个要更新的字段" }
  )
export type UpdateSampleInput = z.infer<typeof updateSampleSchema>

// 登记接收 = 补全样本信息（建项目时只有编号+数量）+ 记录到样。物种/组织/实验类型/运输条件收样时必填
export const receiveSampleSchema = z
  .object({
    species: requiredString("请输入样本物种"),
    tissueType: requiredString("请输入组织类型"),
    experimentType: requiredString("请输入实验类型"),
    transportCondition: requiredString("请输入运输条件"),
    sampleCount: nullableNonNegativeInt,
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
  reason: requiredString("请输入异常原因").max(1000, "异常原因最多 1000 字"),
})
export type MarkSampleAbnormalInput = z.infer<typeof markSampleAbnormalSchema>

export const sampleListQuerySchema = z.object({
  q: optionalString,
  status: sampleStatusSchema.optional(),
  projectId: optionalString,
  page: optionalString,
  limit: optionalString,
})
export type SampleListQuery = z.infer<typeof sampleListQuerySchema>
