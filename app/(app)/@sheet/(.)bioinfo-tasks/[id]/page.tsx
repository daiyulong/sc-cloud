import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import type { UserRole as UserRoleValue } from "@/lib/enums"
import { getBioinfoTaskDetail } from "@/lib/bioinfo-tasks/service"
import { DetailSheet, DetailSheetEmpty } from "@/components/detail/detail-sheet"
import { BioinfoTaskSheetBody } from "@/components/bioinfo-tasks/bioinfo-task-sheet-body"

export const dynamic = "force-dynamic"

type InterceptedBioinfoPageProps = {
  params: Promise<{ id: string }>
}

/** /bioinfo-tasks/[id] 的软导航拦截：在当前列表上以侧滑展示详情 */
export default async function InterceptedBioinfoPage({ params }: InterceptedBioinfoPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params
  const detail = await getBioinfoTaskDetail(
    { id: session.user.id, role: session.user.role as UserRoleValue },
    id
  ).catch(() => null)

  return (
    <DetailSheet title={detail ? `生信任务 ${detail.task.taskNo}` : "生信任务详情"}>
      {detail ? (
        <BioinfoTaskSheetBody detail={detail} role={session.user.role} />
      ) : (
        <DetailSheetEmpty message="生信任务不存在或无权限查看。" />
      )}
    </DetailSheet>
  )
}
