import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import type { LanguageModel } from "ai"

/**
 * 多模态识别 provider seam（重构 §6，2026-06 经真实 key 冒烟实测）。
 * 直连 MiniMax OpenAI 兼容端点（不经 Vercel Gateway）；模型/baseURL 走 env、不写死，
 * 将来换模型/供应商（含切境内其它 VL）只动这一处，上层识别/对齐逻辑不变。
 *
 * 实测要点（api.minimaxi.com，境内带 i）：MiniMax-M3 支持视觉；**结构化必须走 tool 模式**——
 * json 模式（response_format）被静默忽略且会吐 <think>+markdown，generateObject 解析必失败。
 * 故识别走 generateText + 单 tool + toolChoice:"required"（见 recognize-experiment-image）。
 */
export const OCR_MODEL_ID = process.env.AI_OCR_MODEL ?? "MiniMax-M3"
export const OCR_BASE_URL = process.env.MINIMAX_BASE_URL ?? "https://api.minimaxi.com/v1"

/** 多模态识别是否启用：缺 key 或显式 MULTIMODAL_ENABLED=0 时关闭（隐藏入口、走纯手工）。 */
export function isMultimodalEnabled(): boolean {
  return process.env.MULTIMODAL_ENABLED !== "0" && !!process.env.MINIMAX_API_KEY
}

export function getOcrModel(): LanguageModel {
  const apiKey = process.env.MINIMAX_API_KEY
  if (!apiKey) throw new Error("MINIMAX_API_KEY 未配置，无法调用多模态识别")
  const provider = createOpenAICompatible({
    name: "minimax",
    apiKey,
    baseURL: OCR_BASE_URL,
  })
  return provider(OCR_MODEL_ID)
}
