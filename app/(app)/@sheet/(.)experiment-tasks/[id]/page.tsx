import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import type { UserRole as UserRoleValue } from "@/lib/enums"
import { getOperatorOptions } from "@/lib/experiment-tasks/options"
import { getExperimentTaskDetail } from "@/lib/experiment-tasks/service"
import { DetailSheet, DetailSheetEmpty } from "@/components/detail/detail-sheet"
import { ExperimentTaskSheetBody } from "@/components/experiment-tasks/experiment-task-sheet-body"

export const dynamic = "force-dynamic"

type InterceptedTaskPageProps = {
  params: Promise<{ id: string }>
}

/** /experiment-tasks/[id] 的软导航拦截：在当前列表上以侧滑展示详情 */
export default async function InterceptedTaskPage({ params }: InterceptedTaskPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params
  const [detail, operatorOptions] = await Promise.all([
    getExperimentTaskDetail(
      { id: session.user.id, role: session.user.role as UserRoleValue },
      id
    ).catch(() => null),
    getOperatorOptions(),
  ])

  return (
    <DetailSheet title={detail ? `实验任务 ${detail.task.taskNo}` : "实验任务详情"}>
      {detail ? (
        <ExperimentTaskSheetBody
          detail={detail}
          role={session.user.role}
          operatorOptions={operatorOptions}
        />
      ) : (
        <DetailSheetEmpty message="实验任务不存在或无权限查看。" />
      )}
    </DetailSheet>
  )
}
