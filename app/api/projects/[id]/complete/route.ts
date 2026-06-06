import { NextResponse } from "next/server"
import { handleApiError, requireAuth, type RouteContext } from "@/lib/api-utils"
import { completeProject, handleProjectDomainError } from "@/lib/projects/service"
import type { UserRole } from "@/lib/enums"

export async function POST(_request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const project = await completeProject(
      { id: session.user.id, role: session.user.role as UserRole },
      id
    )

    return NextResponse.json({ data: project })
  } catch (error) {
    return handleProjectDomainError(error) ?? handleApiError(error, "完成项目失败")
  }
}
