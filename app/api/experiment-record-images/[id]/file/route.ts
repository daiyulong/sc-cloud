import { NextResponse } from "next/server"
import { handleApiError, requireAuth, type RouteContext } from "@/lib/api-utils"
import {
  handleExperimentRecordError,
  readRecordImageFile,
} from "@/lib/experiment-records/service"
import type { UserRole } from "@/lib/enums"

// 鉴权代理读原图：校验在该图所属项目 scope 内 → 服务端读本地磁盘流式回传（私有，不缓存）
export async function GET(_request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const { bytes, mediaType } = await readRecordImageFile(
      { id: session.user.id, role: session.user.role as UserRole },
      id
    )
    return new NextResponse(new Uint8Array(bytes), {
      headers: { "Content-Type": mediaType, "Cache-Control": "private, no-store" },
    })
  } catch (error) {
    return handleExperimentRecordError(error) ?? handleApiError(error, "读取图片失败")
  }
}
