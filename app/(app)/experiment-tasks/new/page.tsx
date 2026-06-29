import { redirect } from "next/navigation"
import { firstParam } from "@/lib/utils"
import { auth } from "@/lib/auth"
import { SetBreadcrumb } from "@/components/header-breadcrumb"
import { type UserRole as UserRoleValue } from "@/lib/enums"
import { canActAsStaff } from "@/lib/auth/action-roles"
import { getOperatorOptions, getTaskSampleOptions } from "@/lib/experiment-tasks/options"
import { ExperimentTaskForm } from "@/components/experiment-tasks/experiment-task-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const dynamic = "force-dynamic"

type NewExperimentTaskPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function NewExperimentTaskPage({ searchParams }: NewExperimentTaskPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const role = session.user.role as UserRoleValue
  if (!canActAsStaff(role)) {
    redirect("/lab")
  }

  const raw = (await searchParams) ?? {}
  const initialSampleId = firstParam(raw.sampleId)
  const [sampleOptions, operatorOptions] = await Promise.all([
    getTaskSampleOptions({ id: session.user.id, role }),
    getOperatorOptions(),
  ])

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <SetBreadcrumb items={[{ label: "实验", href: "/lab" }, { label: "新建" }]} />
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">新建实验任务</h1>
        <p className="text-sm text-muted-foreground">
          从已接收样本创建任务；填写计划日期即进入已排期，否则为待排期。
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>任务信息</CardTitle>
          <CardDescription>任务编号由系统按委托单生成。</CardDescription>
        </CardHeader>
        <CardContent>
          <ExperimentTaskForm
            mode="create"
            sampleOptions={sampleOptions}
            operatorOptions={operatorOptions}
            initialSampleId={initialSampleId}
          />
        </CardContent>
      </Card>
    </div>
  )
}
