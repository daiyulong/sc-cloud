import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { type UserRole as UserRoleValue } from "@/lib/enums"
import { sampleCreateRoles } from "@/lib/samples/rules"
import { getSampleProjectOptions } from "@/lib/samples/options"
import { FormModal } from "@/components/detail/form-modal"
import { SampleForm } from "@/components/samples/sample-form"

export const dynamic = "force-dynamic"

type InterceptedNewSamplePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

/**
 * /samples/new 的软导航拦截：居中模态打开登记表单（创建是聚焦任务，用模态不用侧滑）。
 * 此静态拦截同时阻止 (.)samples/[id] 把 "new" 当成详情 id。
 */
export default async function InterceptedNewSamplePage({
  searchParams,
}: InterceptedNewSamplePageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const role = session.user.role as UserRoleValue
  if (!sampleCreateRoles.includes(role as (typeof sampleCreateRoles)[number])) {
    redirect("/samples")
  }

  const raw = (await searchParams) ?? {}
  const initialProjectId = first(raw.projectId)
  const projectOptions = await getSampleProjectOptions({ id: session.user.id, role })

  return (
    <FormModal
      title="登记样本"
      description="登记后状态为待到样，到样时由接收员执行接收动作。"
    >
      <SampleForm
        mode="create"
        projectOptions={projectOptions}
        initialProjectId={initialProjectId}
      />
    </FormModal>
  )
}
