import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { type UserRole as UserRoleValue } from "@/lib/enums"
import { getProjectDetail } from "@/lib/projects/service"
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

type EditProjectPageProps = {
  params: Promise<{ id: string }>
}

export default async function EditProjectPage({ params }: EditProjectPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params
  const [{ project }, { salesUsers, managerUsers }] = await Promise.all([
    getProjectDetail({ id: session.user.id, role: session.user.role as UserRoleValue }, id).catch(
      () => notFound()
    ),
    getProjectUserOptions(),
  ])

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">编辑项目</h1>
        <p className="text-sm text-muted-foreground">{project.projectNo}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>项目信息</CardTitle>
          <CardDescription>项目状态只能通过详情页的动作按钮推进。</CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectForm
            mode="edit"
            project={project}
            currentUser={{ id: session.user.id, role: session.user.role as UserRoleValue }}
            salesUsers={salesUsers}
            managerUsers={managerUsers}
          />
        </CardContent>
      </Card>
    </div>
  )
}
