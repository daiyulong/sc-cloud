import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { type UserRole as UserRoleValue } from "@/lib/enums"
import { bioinfoCreateRoles } from "@/lib/bioinfo-tasks/rules"
import { getAnalystOptions, getBioinfoExperimentTaskOptions } from "@/lib/bioinfo-tasks/options"
import { FormModal } from "@/components/detail/form-modal"
import { BioinfoTaskForm } from "@/components/bioinfo-tasks/bioinfo-task-form"

export const dynamic = "force-dynamic"

type InterceptedNewBioinfoPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

/**
 * /bioinfo-tasks/new 的软导航拦截：居中模态打开创建表单。
 * 此静态拦截同时阻止 (.)bioinfo-tasks/[id] 把 "new" 当成详情 id。
 */
export default async function InterceptedNewBioinfoPage({
  searchParams,
}: InterceptedNewBioinfoPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const role = session.user.role as UserRoleValue
  if (!bioinfoCreateRoles.includes(role as (typeof bioinfoCreateRoles)[number])) {
    redirect("/bioinfo-tasks")
  }

  const raw = (await searchParams) ?? {}
  const initialExperimentTaskId = first(raw.experimentTaskId)
  const [experimentTaskOptions, analystOptions] = await Promise.all([
    getBioinfoExperimentTaskOptions({ id: session.user.id, role }),
    getAnalystOptions(),
  ])

  return (
    <FormModal
      title="新建生信任务"
      description="从已完成的实验任务创建（仅含生信分析的项目）；创建后状态为待开始。"
    >
      <BioinfoTaskForm
        mode="create"
        experimentTaskOptions={experimentTaskOptions}
        analystOptions={analystOptions}
        initialExperimentTaskId={initialExperimentTaskId}
      />
    </FormModal>
  )
}
