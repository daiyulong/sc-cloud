import { handleApiError, paginatedResponse, parsePagination, requireAuth } from "@/lib/api-utils"
import { bioinfoTaskListQuerySchema } from "@/lib/schemas/bioinfo-task"
import { handleBioinfoTaskDomainError, listBioinfoTasks } from "@/lib/bioinfo-tasks/service"
import type { UserRole } from "@/lib/enums"

export async function GET(request: Request) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const query = bioinfoTaskListQuerySchema.parse(Object.fromEntries(searchParams))
    const { page, limit, skip } = parsePagination(searchParams)
    const { data, total } = await listBioinfoTasks(
      { id: session.user.id, role: session.user.role as UserRole },
      query,
      { skip, limit }
    )

    return paginatedResponse(data, total, page, limit)
  } catch (error) {
    return handleBioinfoTaskDomainError(error) ?? handleApiError(error, "获取生信任务列表失败")
  }
}
