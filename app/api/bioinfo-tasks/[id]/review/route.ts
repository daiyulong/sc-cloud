import { NextResponse } from "next/server"
import { handleApiError, requireAuth, type RouteContext } from "@/lib/api-utils"
import { handleBioinfoTaskDomainError, reviewBioinfoTask } from "@/lib/bioinfo-tasks/service"
import type { UserRole } from "@/lib/enums"

export async function POST(_request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const task = await reviewBioinfoTask(
      { id: session.user.id, role: session.user.role as UserRole },
      id
    )

    return NextResponse.json({ data: task })
  } catch (error) {
    return handleBioinfoTaskDomainError(error) ?? handleApiError(error, "提交审核失败")
  }
}
