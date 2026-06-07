import { NextResponse } from "next/server"
import { handleApiError, parseJsonBody, requireAuth, type RouteContext } from "@/lib/api-utils"
import { receiveSampleSchema } from "@/lib/schemas/sample"
import { handleSampleDomainError, receiveSample } from "@/lib/samples/service"
import type { UserRole } from "@/lib/enums"

export async function POST(request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const input = receiveSampleSchema.parse(await parseJsonBody(request))
    const sample = await receiveSample(
      { id: session.user.id, role: session.user.role as UserRole },
      id,
      input
    )

    return NextResponse.json({ data: sample })
  } catch (error) {
    return handleSampleDomainError(error) ?? handleApiError(error, "接收样本失败")
  }
}
