import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { type UserRole as UserRoleValue } from "@/lib/enums"
import { sampleCreateRoles } from "@/lib/samples/rules"
import { getSampleProjectOptions } from "@/lib/samples/options"
import { SampleForm } from "@/components/samples/sample-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const dynamic = "force-dynamic"

type NewSamplePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function NewSamplePage({ searchParams }: NewSamplePageProps) {
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
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">登记样本</h1>
        <p className="text-sm text-muted-foreground">
          登记后状态为待到样，到样时由接收员执行接收动作。
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>样本信息</CardTitle>
          <CardDescription>样品编号在业务样本表内唯一。</CardDescription>
        </CardHeader>
        <CardContent>
          <SampleForm
            mode="create"
            projectOptions={projectOptions}
            initialProjectId={initialProjectId}
          />
        </CardContent>
      </Card>
    </div>
  )
}
