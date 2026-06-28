import { NextResponse } from "next/server"
import { handleApiError, requireAuth, type RouteContext } from "@/lib/api-utils"
import { confirmRecordImageSchema } from "@/lib/schemas/experiment-record"
import {
  confirmRecordImage,
  handleExperimentRecordError,
} from "@/lib/experiment-records/service"
import type { UserRole } from "@/lib/enums"

// 人工确认写回：成对写 Sample.sampleName + QcRecord(ai_confirmed)，HITL + 幂等
export async function POST(request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const input = confirmRecordImageSchema.parse(await request.json())
    const result = await confirmRecordImage(
      { id: session.user.id, role: session.user.role as UserRole },
      id,
      input
    )
    return NextResponse.json({ data: result })
  } catch (error) {
    return handleExperimentRecordError(error) ?? handleApiError(error, "确认实验记录失败")
  }
}
