import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { UserRole, type UserRole as UserRoleValue } from "@/lib/enums"
import { getProjectUserOptions } from "@/lib/projects/options"
import { FormModal } from "@/components/detail/form-modal"
import { ProjectForm } from "@/components/projects/project-form"

export const dynamic = "force-dynamic"

function canCreateProject(role?: UserRoleValue) {
  return role === UserRole.admin || role === UserRole.sales_owner || role === UserRole.project_manager
}

/**
 * /projects/new 的软导航拦截：居中模态打开新建表单（创建是聚焦任务，用模态不用侧滑）。
 * 此静态拦截同时阻止 (.)projects/[id] 把 "new" 当成详情 id。
 */
export default async function InterceptedNewProjectPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!canCreateProject(session.user.role as UserRoleValue)) redirect("/projects")

  const { salesUsers, managerUsers } = await getProjectUserOptions()

  return (
    <FormModal
      title="新建项目"
      description="按委托单粒度创建，状态为草稿，需项目经理确认后进入待到样。"
    >
      <ProjectForm
        mode="create"
        currentUser={{ id: session.user.id, role: session.user.role as UserRoleValue }}
        salesUsers={salesUsers}
        managerUsers={managerUsers}
      />
    </FormModal>
  )
}
