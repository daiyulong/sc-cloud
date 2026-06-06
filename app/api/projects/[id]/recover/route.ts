import { NextResponse } from "next/server"
import { handleApiError, requireAuth, type RouteContext } from "@/lib/api-utils"
import { optionalProjectReasonSchema } from "@/lib/schemas/project"
import { handleProjectDomainError, recoverProject } from "@/lib/projects/service"
import type { UserRole } from "@/lib/enums"

export async function POST(request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const input = optionalProjectReasonSchema.parse(await request.json().catch(() => ({})))
    const project = await recoverProject(
      { id: session.user.id, role: session.user.role as UserRole },
      id,
      input
    )

    return NextResponse.json({ data: project })
  } catch (error) {
    return handleProjectDomainError(error) ?? handleApiError(error, "恢复异常失败")
  }
}
