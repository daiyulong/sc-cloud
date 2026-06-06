import { NextResponse } from "next/server"
import { handleApiError, requireAuth, type RouteContext } from "@/lib/api-utils"
import { finishTaskSchema } from "@/lib/schemas/experiment-task"
import {
  finishExperimentTask,
  handleExperimentTaskDomainError,
} from "@/lib/experiment-tasks/service"
import type { UserRole } from "@/lib/enums"

export async function POST(request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const input = finishTaskSchema.parse(await request.json().catch(() => ({})))
    const task = await finishExperimentTask(
      { id: session.user.id, role: session.user.role as UserRole },
      id,
      input
    )

    return NextResponse.json({ data: task })
  } catch (error) {
    return handleExperimentTaskDomainError(error) ?? handleApiError(error, "完成实验失败")
  }
}
