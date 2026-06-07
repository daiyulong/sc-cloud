import { NextResponse } from "next/server"
import { handleApiError, requireAuth, type RouteContext } from "@/lib/api-utils"
import { updateBioinfoTaskSchema } from "@/lib/schemas/bioinfo-task"
import {
  getBioinfoTaskDetail,
  handleBioinfoTaskDomainError,
  updateBioinfoTask,
} from "@/lib/bioinfo-tasks/service"
import type { UserRole } from "@/lib/enums"

export async function GET(_request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const data = await getBioinfoTaskDetail(
      { id: session.user.id, role: session.user.role as UserRole },
      id
    )

    return NextResponse.json({ data })
  } catch (error) {
    return handleBioinfoTaskDomainError(error) ?? handleApiError(error, "获取生信任务详情失败")
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const input = updateBioinfoTaskSchema.parse(await request.json())
    const task = await updateBioinfoTask(
      { id: session.user.id, role: session.user.role as UserRole },
      id,
      input
    )

    return NextResponse.json({ data: task })
  } catch (error) {
    return handleBioinfoTaskDomainError(error) ?? handleApiError(error, "更新生信任务失败")
  }
}
