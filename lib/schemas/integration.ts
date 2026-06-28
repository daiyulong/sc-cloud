import { z } from "zod"
import { nullableNonNegativeInt, nullableNonNegativeNumber, requiredString } from "@/lib/schemas/common"
import { suspensionTypeSchema } from "@/lib/schemas/experiment-task"

/**
 * 产出指标机对机上报（重构 §6.5 / §9）：生信系统侧 cellranger 产出经 API 回写本平台。
 * 归属键 = projectNo + sampleName（同经验视图 join 键）定位样本叶子；产出字段与 recordRunMetrics 同源。
 * 一次上报可含多条（一次 cellranger run 多样本），逐条独立处理、部分成功可报。
 */
export const runMetricsItemSchema = z
  .object({
    projectNo: requiredString("项目编号必填"),
    sampleName: requiredString("样本名必填"),
    suspensionType: suspensionTypeSchema,
    sequencingAmount: nullableNonNegativeNumber,
    capturedCells: nullableNonNegativeInt,
    medianGenes: nullableNonNegativeInt,
  })
  .refine(
    (value) =>
      [value.suspensionType, value.sequencingAmount, value.capturedCells, value.medianGenes].some(
        (v) => v !== undefined && v !== null
      ),
    { message: "每条上报请至少填写一项产出指标" }
  )

export const reportRunMetricsSchema = z.object({
  items: z.array(runMetricsItemSchema).min(1, "至少上报一条").max(500, "单次上报不超过 500 条"),
})

export type ReportRunMetricsInput = z.infer<typeof reportRunMetricsSchema>
export type RunMetricsItemInput = z.infer<typeof runMetricsItemSchema>
