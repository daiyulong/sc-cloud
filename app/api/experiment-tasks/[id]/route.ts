import { NextResponse } from "next/server"
import { handleApiError, requireAuth, type RouteContext } from "@/lib/api-utils"
import { updateExperimentTaskSchema } from "@/lib/schemas/experiment-task"
import {
  getExperimentTaskDetail,
  handleExperimentTaskDomainError,
  updateExperimentTask,
} from "@/lib/experiment-tasks/service"
import type { UserRole } from "@/lib/enums"

export async function GET(_request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const data = await getExperimentTaskDetail(
      { id: session.user.id, role: session.user.role as UserRole },
      id
    )

    return NextResponse.json({ data })
  } catch (error) {
    return handleExperimentTaskDomainError(error) ?? handleApiError(error, "获取实验任务详情失败")
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const input = updateExperimentTaskSchema.parse(await request.json())
    const task = await updateExperimentTask(
      { id: session.user.id, role: session.user.role as UserRole },
      id,
      input
    )

    return NextResponse.json({ data: task })
  } catch (error) {
    return handleExperimentTaskDomainError(error) ?? handleApiError(error, "更新实验任务失败")
  }
}
