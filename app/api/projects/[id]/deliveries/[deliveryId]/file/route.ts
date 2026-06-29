import { NextResponse } from "next/server"
import { handleApiError, requireAuth, type RouteContext } from "@/lib/api-utils"
import {
  handleSequencingDeliveryError,
  readDeliveryAttachment,
} from "@/lib/sequencing-deliveries/service"
import type { UserRole } from "@/lib/enums"

// 鉴权代理读交付存证文件：校验所属项目 scope → 服务端读本地磁盘流式回传（私有，不缓存）。
export async function GET(_request: Request, context: RouteContext<{ id: string; deliveryId: string }>) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { deliveryId } = await context.params
    const { bytes, mediaType, filename } = await readDeliveryAttachment(
      { id: session.user.id, role: session.user.role as UserRole },
      deliveryId
    )
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": mediaType,
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    })
  } catch (error) {
    return handleSequencingDeliveryError(error) ?? handleApiError(error, "读取交付文件失败")
  }
}
