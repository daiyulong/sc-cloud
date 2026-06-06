import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { UserRole, type UserRole as UserRoleValue } from "@/lib/enums"
import { getProjectUserOptions } from "@/lib/projects/options"
import { ProjectForm } from "@/components/projects/project-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const dynamic = "force-dynamic"

function canCreateProject(role?: UserRoleValue) {
  return role === UserRole.admin || role === UserRole.sales_owner || role === UserRole.project_manager
}

export default async function NewProjectPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!canCreateProject(session.user.role as UserRoleValue)) redirect("/projects")

  const { salesUsers, managerUsers } = await getProjectUserOptions()

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">新建项目</h1>
        <p className="text-sm text-muted-foreground">项目按委托单编号作为业务粒度。</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>项目信息</CardTitle>
          <CardDescription>创建后状态为草稿，需项目经理确认后进入待到样。</CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectForm
            mode="create"
            currentUser={{ id: session.user.id, role: session.user.role as UserRoleValue }}
            salesUsers={salesUsers}
            managerUsers={managerUsers}
          />
        </CardContent>
      </Card>
    </div>
  )
}
