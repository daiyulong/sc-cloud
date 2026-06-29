import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { type UserRole as UserRoleValue } from "@/lib/enums"
import { canActAsStaff } from "@/lib/auth/action-roles"
import { getAnalystOptions } from "@/lib/bioinfo-tasks/options"
import { getBioinfoTaskDetail } from "@/lib/bioinfo-tasks/service"
import { BioinfoTaskForm } from "@/components/bioinfo-tasks/bioinfo-task-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const dynamic = "force-dynamic"

type EditBioinfoTaskPageProps = {
  params: Promise<{ id: string }>
}

export default async function EditBioinfoTaskPage({ params }: EditBioinfoTaskPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const role = session.user.role as UserRoleValue
  if (!canActAsStaff(role)) {
    redirect("/bioinfo-tasks")
  }

  const { id } = await params
  const [detail, analystOptions] = await Promise.all([
    getBioinfoTaskDetail({ id: session.user.id, role }, id).catch(() => null),
    getAnalystOptions(),
  ])
  if (!detail) notFound()

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">编辑生信任务</h1>
        <p className="text-sm text-muted-foreground">{detail.task.taskNo}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>任务信息</CardTitle>
          <CardDescription>分析状态与交付推进只能通过详情页的动作完成。</CardDescription>
        </CardHeader>
        <CardContent>
          <BioinfoTaskForm mode="edit" task={detail.task} analystOptions={analystOptions} />
        </CardContent>
      </Card>
    </div>
  )
}
