import { NextResponse } from "next/server"
import { handleApiError, requireAuth, type RouteContext } from "@/lib/api-utils"
import { buildTaskOrderData, renderTaskOrderMarkdown } from "@/lib/bioinfo/task-order"
import type { UserRole } from "@/lib/enums"

/**
 * 生信任务单生成（重构 §6.5）：按模板从项目数据渲染 Markdown，下载交付 / 作邮件附件。
 * 只读派生文档，可见性经 buildProjectScope 控制（不另设角色墙，全员可见不设墙）。
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const [session, authError] = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const data = await buildTaskOrderData(
      { id: session.user.id, role: session.user.role as UserRole },
      id
    )
    if (!data) return NextResponse.json({ error: "项目不存在或无权访问" }, { status: 404 })

    const md = renderTaskOrderMarkdown(data)
    const asciiName = `task-order-${data.projectNo ?? "draft"}.md`
    const utf8Name = encodeURIComponent(`任务单-${data.projectNo ?? "草稿"}.md`)
    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    return handleApiError(error, "生成任务单失败")
  }
}
