import { NextResponse } from "next/server"
import { handleApiError, paginatedResponse, parsePagination, requireAuth } from "@/lib/api-utils"
import {
  createExperimentTaskWithSamplesSchema,
  experimentTaskListQuerySchema,
} from "@/lib/schemas/experiment-task"
import {
  createExperimentTaskFromSamples,
  handleExperimentTaskDomainError,
  listExperimentTasks,
} from "@/lib/experiment-tasks/service"
import type { UserRole } from "@/lib/enums"

export async function GET(request: Request) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const query = experimentTaskListQuerySchema.parse(Object.fromEntries(searchParams))
    const { page, limit, skip } = parsePagination(searchParams)
    const { data, total } = await listExperimentTasks(
      { id: session.user.id, role: session.user.role as UserRole },
      query,
      { skip, limit }
    )

    return paginatedResponse(data, total, page, limit)
  } catch (error) {
    return handleExperimentTaskDomainError(error) ?? handleApiError(error, "获取实验任务列表失败")
  }
}

/** 多对多入口：一次创建实验任务覆盖 N 个样本叶子（§5.1：已到样 → 任务待排期） */
export async function POST(request: Request) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const input = createExperimentTaskWithSamplesSchema.parse(await request.json())
    const task = await createExperimentTaskFromSamples(
      { id: session.user.id, role: session.user.role as UserRole },
      input
    )

    return NextResponse.json({ data: task }, { status: 201 })
  } catch (error) {
    return handleExperimentTaskDomainError(error) ?? handleApiError(error, "创建实验任务失败")
  }
}
