import { z } from "zod"
import { QCResult, RiskLevel } from "@/lib/enums"

const qcResultSchema = z.enum(Object.values(QCResult) as [string, ...string[]])
const riskLevelSchema = z.enum(Object.values(RiskLevel) as [string, ...string[]])
const pct = z.number().min(0).max(100)

/**
 * 人工确认写回（重构 §6 step5）：每行须绑定到该 task 的一个样本叶子(sampleId)；
 * 活率/结团率范围校验在确认阶段做（识别阶段宽松）。qcResult/riskLevel 可省，缺省按活率派生。
 */
export const confirmRecordImageRowSchema = z.object({
  rowIndex: z.number().int().nonnegative().optional(),
  sampleId: z.string().min(1, "每行须指派到一个样本叶子"),
  sampleName: z.string().trim().min(1).nullable().optional(),
  concentration: z.number().nullable().optional(),
  viability: pct.nullable().optional(),
  aggregationRate: pct.nullable().optional(),
  qcResult: qcResultSchema.optional(),
  riskLevel: riskLevelSchema.optional(),
})

export const confirmRecordImageSchema = z.object({
  rows: z.array(confirmRecordImageRowSchema).min(1, "至少确认一行"),
  reconfirm: z.boolean().optional(),
})

export type ConfirmRecordImageInput = z.infer<typeof confirmRecordImageSchema>
export type ConfirmRecordImageRow = z.infer<typeof confirmRecordImageRowSchema>
