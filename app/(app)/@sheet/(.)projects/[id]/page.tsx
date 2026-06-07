import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import type { UserRole as UserRoleValue } from "@/lib/enums"
import { getProjectDetail } from "@/lib/projects/service"
import { DetailSheet, DetailSheetEmpty } from "@/components/detail/detail-sheet"
import { ProjectSheetBody } from "@/components/projects/project-sheet-body"

export const dynamic = "force-dynamic"

type InterceptedProjectPageProps = {
  params: Promise<{ id: string }>
}

/** /projects/[id] 的软导航拦截：在当前列表上以侧滑展示详情 */
export default async function InterceptedProjectPage({ params }: InterceptedProjectPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params
  const detail = await getProjectDetail(
    { id: session.user.id, role: session.user.role as UserRoleValue },
    id
  ).catch(() => null)

  return (
    <DetailSheet title={detail ? `项目 ${detail.project.projectNo ?? "未编号草稿"}` : "项目详情"}>
      {detail ? (
        <ProjectSheetBody detail={detail} role={session.user.role} />
      ) : (
        <DetailSheetEmpty message="项目不存在或无权限查看。" />
      )}
    </DetailSheet>
  )
}
