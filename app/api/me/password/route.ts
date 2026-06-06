import { NextResponse } from "next/server"
import { handleApiError, requireAuth } from "@/lib/api-utils"
import { changeOwnPasswordSchema } from "@/lib/schemas/user"
import { changeOwnPassword, handleUserDomainError } from "@/lib/users/service"

export async function POST(request: Request) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const body = await request.json()
    const input = changeOwnPasswordSchema.parse(body)
    await changeOwnPassword(session.user.id, input)

    return NextResponse.json({ data: { ok: true } })
  } catch (error) {
    return handleUserDomainError(error) ?? handleApiError(error, "修改密码失败")
  }
}
