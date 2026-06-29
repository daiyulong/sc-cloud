import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { SetBreadcrumb } from "@/components/header-breadcrumb"
import { type UserRole as UserRoleValue } from "@/lib/enums"
import { canActAsStaff } from "@/lib/auth/action-roles"
import { getOperatorOptions } from "@/lib/experiment-tasks/options"
import { getExperimentTaskDetail } from "@/lib/experiment-tasks/service"
import { ExperimentTaskForm } from "@/components/experiment-tasks/experiment-task-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const dynamic = "force-dynamic"

type EditExperimentTaskPageProps = {
  params: Promise<{ id: string }>
}

export default async function EditExperimentTaskPage({ params }: EditExperimentTaskPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const role = session.user.role as UserRoleValue
  if (!canActAsStaff(role)) {
    redirect("/lab")
  }

  const { id } = await params
  const [detail, operatorOptions] = await Promise.all([
    getExperimentTaskDetail({ id: session.user.id, role }, id).catch(() => null),
    getOperatorOptions(),
  ])
  if (!detail) notFound()

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <SetBreadcrumb
        items={[
          { label: "实验", href: "/lab" },
          { label: detail.task.taskNo, href: `/experiment-tasks/${id}` },
          { label: "编辑" },
        ]}
      />
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">编辑实验任务</h1>
        <p className="text-sm text-muted-foreground">{detail.task.taskNo}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>任务信息</CardTitle>
          <CardDescription>状态与结果字段只能通过详情页的动作推进。</CardDescription>
        </CardHeader>
        <CardContent>
          <ExperimentTaskForm
            mode="edit"
            task={detail.task}
            operatorOptions={operatorOptions}
          />
        </CardContent>
      </Card>
    </div>
  )
}
