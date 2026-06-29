import { redirect } from "next/navigation"
import { firstParam } from "@/lib/utils"
import { auth } from "@/lib/auth"
import { type UserRole as UserRoleValue } from "@/lib/enums"
import { canActAsStaff } from "@/lib/auth/action-roles"
import { getAnalystOptions, getBioinfoExperimentTaskOptions } from "@/lib/bioinfo-tasks/options"
import { BioinfoTaskForm } from "@/components/bioinfo-tasks/bioinfo-task-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const dynamic = "force-dynamic"

type NewBioinfoTaskPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function NewBioinfoTaskPage({ searchParams }: NewBioinfoTaskPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const role = session.user.role as UserRoleValue
  if (!canActAsStaff(role)) {
    redirect("/bioinfo-tasks")
  }

  const raw = (await searchParams) ?? {}
  const initialExperimentTaskId = firstParam(raw.experimentTaskId)
  const [experimentTaskOptions, analystOptions] = await Promise.all([
    getBioinfoExperimentTaskOptions({ id: session.user.id, role }),
    getAnalystOptions(),
  ])

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">新建生信任务</h1>
        <p className="text-sm text-muted-foreground">
          从已完成的实验任务创建（仅含生信分析的项目）；创建后状态为待开始。
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>任务信息</CardTitle>
          <CardDescription>任务编号由系统按委托单生成。</CardDescription>
        </CardHeader>
        <CardContent>
          <BioinfoTaskForm
            mode="create"
            experimentTaskOptions={experimentTaskOptions}
            analystOptions={analystOptions}
            initialExperimentTaskId={initialExperimentTaskId}
          />
        </CardContent>
      </Card>
    </div>
  )
}
