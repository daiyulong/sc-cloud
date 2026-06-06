import { NextResponse } from "next/server"
import { handleApiError, requireAuth, type RouteContext } from "@/lib/api-utils"
import { createExperimentTaskSchema } from "@/lib/schemas/experiment-task"
import {
  createExperimentTaskFromSample,
  handleExperimentTaskDomainError,
} from "@/lib/experiment-tasks/service"
import type { UserRole } from "@/lib/enums"

/** 从样本创建实验任务（§5.1：已到样 → 任务待排期） */
export async function POST(request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const input = createExperimentTaskSchema.parse(await request.json())
    const task = await createExperimentTaskFromSample(
      { id: session.user.id, role: session.user.role as UserRole },
      id,
      input
    )

    return NextResponse.json({ data: task }, { status: 201 })
  } catch (error) {
    return handleExperimentTaskDomainError(error) ?? handleApiError(error, "创建实验任务失败")
  }
}
