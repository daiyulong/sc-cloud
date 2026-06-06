import { NextResponse } from "next/server"
import { handleApiError, requireAuth, type RouteContext } from "@/lib/api-utils"
import { updateSampleSchema } from "@/lib/schemas/sample"
import {
  getSampleDetail,
  handleSampleDomainError,
  updateSample,
} from "@/lib/samples/service"
import type { UserRole } from "@/lib/enums"

export async function GET(_request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const data = await getSampleDetail(
      { id: session.user.id, role: session.user.role as UserRole },
      id
    )

    return NextResponse.json({ data })
  } catch (error) {
    return handleSampleDomainError(error) ?? handleApiError(error, "获取样本详情失败")
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const input = updateSampleSchema.parse(await request.json())
    const sample = await updateSample(
      { id: session.user.id, role: session.user.role as UserRole },
      id,
      input
    )

    return NextResponse.json({ data: sample })
  } catch (error) {
    return handleSampleDomainError(error) ?? handleApiError(error, "更新样本失败")
  }
}
