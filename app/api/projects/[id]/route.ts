import { NextResponse } from "next/server"
import { handleApiError, requireAuth, type RouteContext } from "@/lib/api-utils"
import { updateProjectSchema } from "@/lib/schemas/project"
import {
  deleteProject,
  getProjectDetail,
  handleProjectDomainError,
  updateProject,
} from "@/lib/projects/service"
import type { UserRole } from "@/lib/enums"

export async function GET(_request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const data = await getProjectDetail(
      { id: session.user.id, role: session.user.role as UserRole },
      id
    )

    return NextResponse.json({ data })
  } catch (error) {
    return handleProjectDomainError(error) ?? handleApiError(error, "获取项目详情失败")
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const input = updateProjectSchema.parse(await request.json())
    const project = await updateProject(
      { id: session.user.id, role: session.user.role as UserRole },
      id,
      input
    )

    return NextResponse.json({ data: project })
  } catch (error) {
    return handleProjectDomainError(error) ?? handleApiError(error, "更新项目失败")
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    await deleteProject({ id: session.user.id, role: session.user.role as UserRole }, id)

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleProjectDomainError(error) ?? handleApiError(error, "删除项目失败")
  }
}
