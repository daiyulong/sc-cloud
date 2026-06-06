import { NextResponse } from "next/server"
import { handleApiError, paginatedResponse, parsePagination, requireAdmin } from "@/lib/api-utils"
import { createUserSchema, userListQuerySchema } from "@/lib/schemas/user"
import { createUser, handleUserDomainError, listUsers } from "@/lib/users/service"

export async function GET(request: Request) {
  try {
    const [, authError] = await requireAdmin()
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const query = userListQuerySchema.parse(Object.fromEntries(searchParams))
    const { page, limit, skip } = parsePagination(searchParams)
    const { data, total } = await listUsers(query, { skip, limit })

    return paginatedResponse(data, total, page, limit)
  } catch (error) {
    return handleUserDomainError(error) ?? handleApiError(error, "获取用户列表失败")
  }
}

export async function POST(request: Request) {
  try {
    const [session, authError] = await requireAdmin()
    if (authError) return authError

    const body = await request.json()
    const input = createUserSchema.parse(body)
    const user = await createUser(session.user.id, input)

    return NextResponse.json({ data: user }, { status: 201 })
  } catch (error) {
    return handleUserDomainError(error) ?? handleApiError(error, "创建用户失败")
  }
}
