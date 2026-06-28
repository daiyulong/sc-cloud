import { NextResponse } from "next/server"
import { handleApiError, requireAuth, type RouteContext } from "@/lib/api-utils"
import {
  handleExperimentRecordError,
  uploadRecordImage,
} from "@/lib/experiment-records/service"
import type { UserRole } from "@/lib/enums"

// 上传实验记录图片（multipart，避开 Server Action 1MB 体限）：存证 + 内联多模态识别（仅预填）
export async function POST(request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "缺少图片文件（字段名 file）" }, { status: 400 })
    }
    const bytes = Buffer.from(await file.arrayBuffer())
    const result = await uploadRecordImage(
      { id: session.user.id, role: session.user.role as UserRole },
      id,
      { bytes, mediaType: file.type }
    )
    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    return handleExperimentRecordError(error) ?? handleApiError(error, "上传实验记录失败")
  }
}
