import { NextResponse } from "next/server"
import { handleApiError, paginatedResponse, parsePagination, requireAuth } from "@/lib/api-utils"
import { createSampleSchema, sampleListQuerySchema } from "@/lib/schemas/sample"
import { createSample, handleSampleDomainError, listSamples } from "@/lib/samples/service"
import type { UserRole } from "@/lib/enums"

export async function GET(request: Request) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const query = sampleListQuerySchema.parse(Object.fromEntries(searchParams))
    const { page, limit, skip } = parsePagination(searchParams)
    const { data, total } = await listSamples(
      { id: session.user.id, role: session.user.role as UserRole },
      query,
      { skip, limit }
    )

    return paginatedResponse(data, total, page, limit)
  } catch (error) {
    return handleSampleDomainError(error) ?? handleApiError(error, "获取样本列表失败")
  }
}

export async function POST(request: Request) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const body = await request.json()
    const input = createSampleSchema.parse(body)
    const sample = await createSample(
      { id: session.user.id, role: session.user.role as UserRole },
      input
    )

    return NextResponse.json({ data: sample }, { status: 201 })
  } catch (error) {
    return handleSampleDomainError(error) ?? handleApiError(error, "新增样本失败")
  }
}
