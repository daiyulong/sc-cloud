import { z } from "zod"
import {
  ExperimentTaskStatus,
  QCResult,
  ResultStatus,
  RiskLevel,
  type ExperimentTaskStatus as ExperimentTaskStatusValue,
  type QCResult as QCResultValue,
  type ResultStatus as ResultStatusValue,
  type RiskLevel as RiskLevelValue,
} from "@/lib/enums"
import {
  nullableDate,
  nullableNonNegativeInt,
  nullableNonNegativeNumber,
  nullablePercent,
  nullableString,
  optionalString,
  requiredString,
} from "@/lib/schemas/common"

const experimentTaskStatusValues = Object.values(ExperimentTaskStatus) as [
  ExperimentTaskStatusValue,
  ...ExperimentTaskStatusValue[],
]
const resultStatusValues = Object.values(ResultStatus) as [
  ResultStatusValue,
  ...ResultStatusValue[],
]
const qcResultValues = Object.values(QCResult) as [QCResultValue, ...QCResultValue[]]
const riskLevelValues = Object.values(RiskLevel) as [RiskLevelValue, ...RiskLevelValue[]]

export const experimentTaskStatusSchema = z.enum(experimentTaskStatusValues)
export const resultStatusSchema = z.enum(resultStatusValues)
export const qcResultSchema = z.enum(qcResultValues)
export const riskLevelSchema = z.enum(riskLevelValues)

/** 创建实验任务：样本由 URL 路径段提供（POST /api/samples/{id}/experiment-tasks），此处只收任务字段 */
export const createExperimentTaskSchema = z.object({
  experimentType: requiredString("请输入实验类型"),
  runMethod: nullableString,
  department: nullableString,
  plannedDate: nullableDate,
  operatorId: nullableString,
})
export type CreateExperimentTaskInput = z.infer<typeof createExperimentTaskSchema>

/** 整体更新（PUT）：不含状态/结果字段（走对应动作），至少一个字段 */
export const updateExperimentTaskSchema = z
  .object({
    experimentType: optionalString,
    runMethod: nullableString,
    department: nullableString,
    plannedDate: nullableDate,
    operatorId: nullableString,
    loadedSampleCount: nullableNonNegativeInt,
  })
  .refine(
    (value) => Object.keys(value).some((key) => value[key as keyof typeof value] !== undefined),
    { message: "至少提供一个要更新的字段" }
  )
export type UpdateExperimentTaskInput = z.infer<typeof updateExperimentTaskSchema>

/** 设置排期：计划日期必填，可同时指派负责人 / 上机方式 / 部门 */
export const scheduleTaskSchema = z.object({
  plannedDate: z.preprocess((value) => {
    if (value instanceof Date) return value
    if (typeof value === "string" && value.trim() !== "") {
      const date = new Date(value)
      return Number.isNaN(date.getTime()) ? value : date
    }
    return value
  }, z.date("请填写计划实验日期")),
  operatorId: nullableString,
  runMethod: nullableString,
  department: nullableString,
})
export type ScheduleTaskInput = z.infer<typeof scheduleTaskSchema>

/** 开始实验：可选覆盖实际实验日期（默认取当前时间） */
export const startTaskSchema = z.object({
  actualDate: nullableDate,
})
export type StartTaskInput = z.infer<typeof startTaskSchema>

/** 完成实验（待反馈）：录入上机信息，进入待反馈 */
export const finishTaskSchema = z.object({
  actualDate: nullableDate,
  loadedSampleCount: nullableNonNegativeInt,
})
export type FinishTaskInput = z.infer<typeof finishTaskSchema>

/** 提交实验反馈：结果状态 + 结果反馈必填（§8.8），可补录上机数与实际日期 */
export const submitFeedbackSchema = z.object({
  resultStatus: resultStatusSchema,
  resultFeedback: requiredString("请输入结果反馈").max(2000, "结果反馈最多 2000 字"),
  loadedSampleCount: nullableNonNegativeInt,
  actualDate: nullableDate,
})
export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>

/** 录入质控：结论 + 风险等级必填；活率/结团率 0-100（§8.4），与任务执行态正交（不改任务状态） */
export const recordQcSchema = z.object({
  concentration: nullableNonNegativeNumber,
  viability: nullablePercent,
  aggregationRate: nullablePercent,
  qcResult: qcResultSchema,
  riskLevel: riskLevelSchema,
  reason: nullableString,
  feedback: nullableString,
})
export type RecordQcInput = z.infer<typeof recordQcSchema>

export const experimentTaskListQuerySchema = z.object({
  q: optionalString,
  status: experimentTaskStatusSchema.optional(),
  projectId: optionalString,
  operatorId: optionalString,
  /** today = 计划实验日期为今日（工作台「今日实验」入口） */
  date: z.enum(["today"]).optional(),
  page: optionalString,
  limit: optionalString,
})
export type ExperimentTaskListQuery = z.infer<typeof experimentTaskListQuerySchema>
