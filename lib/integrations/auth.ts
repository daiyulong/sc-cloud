import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"

/**
 * 服务令牌鉴权（重构 §9 生信集成）：机对机端点不走 NextAuth 会话，
 * 用 env `INTEGRATION_API_KEY` 校验请求头。支持 `Authorization: Bearer <key>` 或 `X-Api-Key: <key>`。
 * 未配置 key 视为该集成关闭，返回 503。
 */
function extractToken(request: Request): string | null {
  const auth = request.headers.get("authorization")
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim() || null
  const apiKey = request.headers.get("x-api-key")
  return apiKey?.trim() || null
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  // 长度不等直接判否（timingSafeEqual 要求等长）；长度差异本身不泄露 key 内容
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/** 返回错误响应（鉴权失败）或 null（通过）。 */
export function requireServiceToken(request: Request): NextResponse | null {
  const expected = process.env.INTEGRATION_API_KEY
  if (!expected) {
    return NextResponse.json({ error: "集成接口未启用" }, { status: 503 })
  }
  const provided = extractToken(request)
  if (!provided || !safeEqual(provided, expected)) {
    return NextResponse.json({ error: "服务令牌无效" }, { status: 401 })
  }
  return null
}
