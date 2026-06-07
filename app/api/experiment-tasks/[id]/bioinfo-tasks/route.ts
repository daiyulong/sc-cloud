import { NextResponse } from "next/server"
import { handleApiError, requireAuth, type RouteContext } from "@/lib/api-utils"
import { createBioinfoTaskSchema } from "@/lib/schemas/bioinfo-task"
import {
  createBioinfoTaskFromExperiment,
  handleBioinfoTaskDomainError,
} from "@/lib/bioinfo-tasks/service"
import type { UserRole } from "@/lib/enums"

/** 从实验任务创建生信任务（§5.1：实验任务已完成且服务含生信 → 生信待开始） */
export async function POST(request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const input = createBioinfoTaskSchema.parse(await request.json())
    const task = await createBioinfoTaskFromExperiment(
      { id: session.user.id, role: session.user.role as UserRole },
      id,
      input
    )

    return NextResponse.json({ data: task }, { status: 201 })
  } catch (error) {
    return handleBioinfoTaskDomainError(error) ?? handleApiError(error, "创建生信任务失败")
  }
}
