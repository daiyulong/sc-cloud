import { NextResponse } from "next/server"
import { handleApiError, requireAdmin, type RouteContext } from "@/lib/api-utils"
import { updateUserSchema } from "@/lib/schemas/user"
import { handleUserDomainError, updateUser } from "@/lib/users/service"

export async function PUT(request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAdmin()
    if (authError) return authError

    const { id } = await context.params
    const body = await request.json()
    const input = updateUserSchema.parse(body)
    const user = await updateUser(session.user.id, id, input)

    return NextResponse.json({ data: user })
  } catch (error) {
    return handleUserDomainError(error) ?? handleApiError(error, "更新用户失败")
  }
}
