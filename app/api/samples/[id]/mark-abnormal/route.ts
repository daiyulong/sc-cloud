import { NextResponse } from "next/server"
import { handleApiError, requireAuth, type RouteContext } from "@/lib/api-utils"
import { markSampleAbnormalSchema } from "@/lib/schemas/sample"
import { handleSampleDomainError, markSampleAbnormal } from "@/lib/samples/service"
import type { UserRole } from "@/lib/enums"

export async function POST(request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const input = markSampleAbnormalSchema.parse(await request.json())
    const sample = await markSampleAbnormal(
      { id: session.user.id, role: session.user.role as UserRole },
      id,
      input
    )

    return NextResponse.json({ data: sample })
  } catch (error) {
    return handleSampleDomainError(error) ?? handleApiError(error, "登记样本异常失败")
  }
}
