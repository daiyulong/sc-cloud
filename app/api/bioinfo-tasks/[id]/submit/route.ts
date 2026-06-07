import { NextResponse } from "next/server"
import { handleApiError, parseJsonBody, requireAuth, type RouteContext } from "@/lib/api-utils"
import { submitBioinfoTaskSchema } from "@/lib/schemas/bioinfo-task"
import { handleBioinfoTaskDomainError, submitBioinfoTask } from "@/lib/bioinfo-tasks/service"
import type { UserRole } from "@/lib/enums"

export async function POST(request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const input = submitBioinfoTaskSchema.parse(await parseJsonBody(request))
    const task = await submitBioinfoTask(
      { id: session.user.id, role: session.user.role as UserRole },
      id,
      input
    )

    return NextResponse.json({ data: task })
  } catch (error) {
    return handleBioinfoTaskDomainError(error) ?? handleApiError(error, "提交报告失败")
  }
}
