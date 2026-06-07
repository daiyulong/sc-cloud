import { NextResponse } from "next/server"
import { handleApiError, parseJsonBody, requireAuth, type RouteContext } from "@/lib/api-utils"
import { confirmProjectSchema } from "@/lib/schemas/project"
import { confirmProject, handleProjectDomainError } from "@/lib/projects/service"
import type { UserRole } from "@/lib/enums"

export async function POST(request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const input = confirmProjectSchema.parse(await parseJsonBody(request))
    const project = await confirmProject(
      { id: session.user.id, role: session.user.role as UserRole },
      id,
      input
    )

    return NextResponse.json({ data: project })
  } catch (error) {
    return handleProjectDomainError(error) ?? handleApiError(error, "确认项目失败")
  }
}
