import { z } from "zod"

/**
 * 实验记录图片识别结果（扁平 rows）。重构 §6：一行一捕获，对齐到该 task 的样本叶子。
 * 识别阶段宽松（数值可空、不卡 0-100），把范围/绑定校验留到人工确认（confirm）阶段——
 * 否则模型一处误读会让整张图解析失败。字段命名与 ExperimentRecordImage.ocrResult 注释一致。
 */
export const ocrRowSchema = z.object({
  rawText: z.string().nullish().describe("该行原始文本片段；读不到填 null"),
  sampleName: z.string().nullable().describe("样本名（常带 YP 前缀）；读不到填 null"),
  concentration: z.number().nullable().describe("悬液浓度（个/ul）；读不到填 null"),
  viability: z.number().nullable().describe("活率（百分数 0-100）；读不到填 null"),
  aggregationRate: z.number().nullable().describe("结团率（百分数 0-100）；读不到填 null"),
})

export const ocrResultSchema = z.object({
  rows: z.array(ocrRowSchema).describe("逐行（逐样本/逐捕获）抽取结果"),
})

export type OcrRow = z.infer<typeof ocrRowSchema>
export type OcrResult = z.infer<typeof ocrResultSchema>
