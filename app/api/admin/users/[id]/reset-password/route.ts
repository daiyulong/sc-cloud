import { NextResponse } from "next/server"
import { handleApiError, requireAdmin, type RouteContext } from "@/lib/api-utils"
import { resetPasswordSchema } from "@/lib/schemas/user"
import { handleUserDomainError, resetUserPassword } from "@/lib/users/service"

export async function POST(request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAdmin()
    if (authError) return authError

    const { id } = await context.params
    const body = await request.json()
    const input = resetPasswordSchema.parse(body)
    await resetUserPassword(session.user.id, id, input.password)

    return NextResponse.json({ data: { ok: true } })
  } catch (error) {
    return handleUserDomainError(error) ?? handleApiError(error, "重置密码失败")
  }
}
