import { NextResponse } from "next/server"
import { handleApiError, parseJsonBody, requireAuth, type RouteContext } from "@/lib/api-utils"
import { scheduleTaskSchema } from "@/lib/schemas/experiment-task"
import {
  handleExperimentTaskDomainError,
  scheduleExperimentTask,
} from "@/lib/experiment-tasks/service"
import type { UserRole } from "@/lib/enums"

export async function POST(request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const input = scheduleTaskSchema.parse(await parseJsonBody(request))
    const task = await scheduleExperimentTask(
      { id: session.user.id, role: session.user.role as UserRole },
      id,
      input
    )

    return NextResponse.json({ data: task })
  } catch (error) {
    return handleExperimentTaskDomainError(error) ?? handleApiError(error, "设置排期失败")
  }
}
