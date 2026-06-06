import { NextResponse } from "next/server"
import { handleApiError, requireAuth, type RouteContext } from "@/lib/api-utils"
import { submitFeedbackSchema } from "@/lib/schemas/experiment-task"
import {
  handleExperimentTaskDomainError,
  submitExperimentFeedback,
} from "@/lib/experiment-tasks/service"
import type { UserRole } from "@/lib/enums"

export async function POST(request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const input = submitFeedbackSchema.parse(await request.json().catch(() => ({})))
    const task = await submitExperimentFeedback(
      { id: session.user.id, role: session.user.role as UserRole },
      id,
      input
    )

    return NextResponse.json({ data: task })
  } catch (error) {
    return handleExperimentTaskDomainError(error) ?? handleApiError(error, "提交实验反馈失败")
  }
}
