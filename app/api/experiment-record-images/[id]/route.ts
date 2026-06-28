import { NextResponse } from "next/server"
import { handleApiError, requireAuth, type RouteContext } from "@/lib/api-utils"
import {
  getRecordImageAlignment,
  handleExperimentRecordError,
} from "@/lib/experiment-records/service"
import type { UserRole } from "@/lib/enums"

// 重新打开对齐：取识别结果 + 候选叶子
export async function GET(_request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const data = await getRecordImageAlignment(
      { id: session.user.id, role: session.user.role as UserRole },
      id
    )
    return NextResponse.json({ data })
  } catch (error) {
    return handleExperimentRecordError(error) ?? handleApiError(error, "获取识别记录失败")
  }
}
