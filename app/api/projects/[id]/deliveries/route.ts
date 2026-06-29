import { NextResponse } from "next/server"
import { handleApiError, requireAuth, type RouteContext } from "@/lib/api-utils"
import {
  createSequencingDelivery,
  handleSequencingDeliveryError,
} from "@/lib/sequencing-deliveries/service"
import { createSequencingDeliverySchema } from "@/lib/schemas/sequencing-delivery"
import type { UserRole } from "@/lib/enums"

// 登记测序交付（multipart）：贴数据存储链接 + 可选上传厂商交付 excel/邮件存证。
export async function POST(request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const form = await request.formData()
    const input = createSequencingDeliverySchema.parse({
      storageUrl: form.get("storageUrl"),
      note: form.get("note"),
    })

    const fileField = form.get("file")
    const file =
      fileField instanceof File && fileField.size > 0
        ? {
            bytes: Buffer.from(await fileField.arrayBuffer()),
            name: fileField.name || "delivery",
            mime: fileField.type || "application/octet-stream",
          }
        : undefined

    const delivery = await createSequencingDelivery(
      { id: session.user.id, role: session.user.role as UserRole },
      id,
      input,
      file
    )
    return NextResponse.json({ data: delivery }, { status: 201 })
  } catch (error) {
    return handleSequencingDeliveryError(error) ?? handleApiError(error, "登记测序交付失败")
  }
}
