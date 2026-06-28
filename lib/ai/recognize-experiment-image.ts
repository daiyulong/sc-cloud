import { generateText, tool } from "ai"
import { getOcrModel, OCR_MODEL_ID } from "@/lib/ai/ocr-provider"
import { ocrResultSchema, type OcrResult } from "@/lib/ai/ocr-schema"

const PROMPT = [
  "你是实验记录单识别助手。识别这张实验记录照片，逐行抽取每个样本/捕获的：",
  "样本名、悬液浓度(个/ul)、活率(%)、结团率(%)。",
  "规则：严格按工具入参 schema 逐行返回；任何读不到或不确定的字段一律填 null，绝不编造或推算；",
  "活率与结团率是 0-100 的百分数；一行对应一个样本/一次捕获。",
].join("\n")

export const RECOGNIZE_MODEL = OCR_MODEL_ID

/**
 * 经 MiniMax 视觉模型从实验记录图片逐行抽取结构化字段（重构 §6）。
 * 用 generateText + 单 tool + toolChoice:"required" 拿干净结构化结果（json 模式在 M3 不可用，
 * 见 ocr-provider 注释）；最终 zod 校验。结果**仅用于预填对齐抽屉**，人工确认后才落库（HITL）。
 */
export async function recognizeExperimentImage(
  bytes: Uint8Array,
  mediaType: string
): Promise<OcrResult> {
  const { toolCalls } = await generateText({
    model: getOcrModel(),
    tools: {
      submit_rows: tool({
        description: "提交逐行抽取的实验记录结果",
        inputSchema: ocrResultSchema,
      }),
    },
    toolChoice: "required",
    maxRetries: 2,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          { type: "image", image: bytes, mediaType },
        ],
      },
    ],
  })

  const call = toolCalls[0]
  if (!call) throw new Error("识别模型未返回结构化结果")
  // 再过一遍 zod（防 provider 侧未严格校验）；失败抛出 → 上层落 ocrStatus=failed、回退手工
  return ocrResultSchema.parse(call.input)
}
