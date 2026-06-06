import { NextResponse } from "next/server"
import { handleApiError, requireAdmin, type RouteContext } from "@/lib/api-utils"
import { handleUserDomainError, toggleUserActive } from "@/lib/users/service"

export async function POST(_request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAdmin()
    if (authError) return authError

    const { id } = await context.params
    const user = await toggleUserActive(session.user.id, id)

    return NextResponse.json({ data: user })
  } catch (error) {
    return handleUserDomainError(error) ?? handleApiError(error, "切换用户状态失败")
  }
}
