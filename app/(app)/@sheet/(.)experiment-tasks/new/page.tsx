import { redirect } from "next/navigation"
import { firstParam } from "@/lib/utils"
import { auth } from "@/lib/auth"
import { type UserRole as UserRoleValue } from "@/lib/enums"
import { experimentManageRoles } from "@/lib/experiment-tasks/rules"
import { getOperatorOptions, getTaskSampleOptions } from "@/lib/experiment-tasks/options"
import { FormModal } from "@/components/detail/form-modal"
import { ExperimentTaskForm } from "@/components/experiment-tasks/experiment-task-form"

export const dynamic = "force-dynamic"

type InterceptedNewTaskPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

/**
 * /experiment-tasks/new 的软导航拦截：居中模态打开创建表单。
 * 此静态拦截同时阻止 (.)experiment-tasks/[id] 把 "new" 当成详情 id。
 */
export default async function InterceptedNewTaskPage({
  searchParams,
}: InterceptedNewTaskPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const role = session.user.role as UserRoleValue
  if (!experimentManageRoles.includes(role as (typeof experimentManageRoles)[number])) {
    redirect("/experiment-tasks")
  }

  const raw = (await searchParams) ?? {}
  const initialSampleId = firstParam(raw.sampleId)
  const [sampleOptions, operatorOptions] = await Promise.all([
    getTaskSampleOptions({ id: session.user.id, role }),
    getOperatorOptions(),
  ])

  return (
    <FormModal
      title="新建实验任务"
      description="从已接收样本创建任务；填写计划日期即进入已排期，否则为待排期。"
    >
      <ExperimentTaskForm
        mode="create"
        sampleOptions={sampleOptions}
        operatorOptions={operatorOptions}
        initialSampleId={initialSampleId}
      />
    </FormModal>
  )
}
