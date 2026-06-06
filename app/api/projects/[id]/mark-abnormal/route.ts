import { NextResponse } from "next/server"
import { handleApiError, requireAuth, type RouteContext } from "@/lib/api-utils"
import { projectReasonSchema } from "@/lib/schemas/project"
import { handleProjectDomainError, markProjectAbnormal } from "@/lib/projects/service"
import type { UserRole } from "@/lib/enums"

export async function POST(request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const input = projectReasonSchema.parse(await request.json())
    const project = await markProjectAbnormal(
      { id: session.user.id, role: session.user.role as UserRole },
      id,
      input
    )

    return NextResponse.json({ data: project })
  } catch (error) {
    return handleProjectDomainError(error) ?? handleApiError(error, "标记异常失败")
  }
}
