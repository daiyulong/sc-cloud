import { NextResponse } from "next/server"
import { handleApiError, parseJsonBody, requireAuth, type RouteContext } from "@/lib/api-utils"
import { recordQcSchema } from "@/lib/schemas/experiment-task"
import {
  handleExperimentTaskDomainError,
  listTaskQcRecords,
  recordTaskQc,
} from "@/lib/experiment-tasks/service"
import type { UserRole } from "@/lib/enums"

export async function GET(_request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const data = await listTaskQcRecords(
      { id: session.user.id, role: session.user.role as UserRole },
      id
    )

    return NextResponse.json({ data })
  } catch (error) {
    return handleExperimentTaskDomainError(error) ?? handleApiError(error, "获取质控记录失败")
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const input = recordQcSchema.parse(await parseJsonBody(request))
    const qc = await recordTaskQc(
      { id: session.user.id, role: session.user.role as UserRole },
      id,
      input
    )

    return NextResponse.json({ data: qc }, { status: 201 })
  } catch (error) {
    return handleExperimentTaskDomainError(error) ?? handleApiError(error, "录入质控失败")
  }
}
