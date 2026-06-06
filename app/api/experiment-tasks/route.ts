import { handleApiError, paginatedResponse, parsePagination, requireAuth } from "@/lib/api-utils"
import { experimentTaskListQuerySchema } from "@/lib/schemas/experiment-task"
import {
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
