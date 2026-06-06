import { NextResponse } from "next/server"
import { handleApiError, paginatedResponse, parsePagination, requireAuth } from "@/lib/api-utils"
import { projectListQuerySchema, createProjectSchema } from "@/lib/schemas/project"
import { createProject, handleProjectDomainError, listProjects } from "@/lib/projects/service"
import type { UserRole } from "@/lib/enums"

export async function GET(request: Request) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const query = projectListQuerySchema.parse(Object.fromEntries(searchParams))
    const { page, limit, skip } = parsePagination(searchParams)
    const { data, total } = await listProjects(
      { id: session.user.id, role: session.user.role as UserRole },
      query,
      { skip, limit }
    )

    return paginatedResponse(data, total, page, limit)
  } catch (error) {
    return handleProjectDomainError(error) ?? handleApiError(error, "获取项目列表失败")
  }
}

export async function POST(request: Request) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const body = await request.json()
    const input = createProjectSchema.parse(body)
    const project = await createProject(
      { id: session.user.id, role: session.user.role as UserRole },
      input
    )

    return NextResponse.json({ data: project }, { status: 201 })
  } catch (error) {
    return handleProjectDomainError(error) ?? handleApiError(error, "创建项目失败")
  }
}
