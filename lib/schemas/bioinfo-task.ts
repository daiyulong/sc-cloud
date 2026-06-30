import { z } from "zod"
import {
  BioinfoTaskStatus,
  type BioinfoTaskStatus as BioinfoTaskStatusValue,
} from "@/lib/enums"
import { nullableDate, nullableString, optionalString, statusListSchema } from "@/lib/schemas/common"

const bioinfoTaskStatusValues = Object.values(BioinfoTaskStatus) as [
  BioinfoTaskStatusValue,
  ...BioinfoTaskStatusValue[],
]

export const bioinfoTaskStatusSchema = z.enum(bioinfoTaskStatusValues)

/** 创建生信任务：关联实验任务由 URL 路径段提供（POST /api/experiment-tasks/{id}/bioinfo-tasks） */
export const createBioinfoTaskSchema = z.object({
  analysisType: nullableString,
  analystId: nullableString,
  dataReceivedAt: nullableDate,
  remark: nullableString,
})
export type CreateBioinfoTaskInput = z.infer<typeof createBioinfoTaskSchema>

/** 整体更新（PUT）：不含状态/交付字段（走对应动作），至少一个字段 */
export const updateBioinfoTaskSchema = z
  .object({
    analysisType: nullableString,
    analystId: nullableString,
    dataReceivedAt: nullableDate,
    deliverableNote: nullableString,
    remark: nullableString,
  })
  .refine(
    (value) => Object.keys(value).some((key) => value[key as keyof typeof value] !== undefined),
    { message: "至少提供一个要更新的字段" }
  )
export type UpdateBioinfoTaskInput = z.infer<typeof updateBioinfoTaskSchema>

/** 开始分析：可选数据接收日期（默认当前时间）+ 指派分析负责人 */
export const startBioinfoTaskSchema = z.object({
  dataReceivedAt: nullableDate,
  analystId: nullableString,
})
export type StartBioinfoTaskInput = z.infer<typeof startBioinfoTaskSchema>

/** 提交报告：记录交付物说明（报告交付日期在项目确认交付时落 deliveredAt，§7.1/§8.9） */
export const submitBioinfoTaskSchema = z.object({
  deliverableNote: nullableString,
  analysisType: nullableString,
})
export type SubmitBioinfoTaskInput = z.infer<typeof submitBioinfoTaskSchema>

export const bioinfoTaskListQuerySchema = z.object({
  q: optionalString,
  range: z.enum(["mine", "unassigned", "all"]).optional(),
  status: statusListSchema(bioinfoTaskStatusValues),
  projectId: optionalString,
  analystId: optionalString,
  /** open = 进行中的开口任务（待开始/分析中/待审核），生信工位「进行中」入口 */
  open: z.enum(["1"]).optional(),
  page: optionalString,
  limit: optionalString,
})
export type BioinfoTaskListQuery = z.infer<typeof bioinfoTaskListQuerySchema>
