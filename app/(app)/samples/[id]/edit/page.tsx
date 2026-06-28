import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { type UserRole as UserRoleValue } from "@/lib/enums"
import { getSampleDetail } from "@/lib/samples/service"
import { SampleForm } from "@/components/samples/sample-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const dynamic = "force-dynamic"

type EditSamplePageProps = {
  params: Promise<{ id: string }>
}

export default async function EditSamplePage({ params }: EditSamplePageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params
  const detail = await getSampleDetail(
    { id: session.user.id, role: session.user.role as UserRoleValue },
    id
  ).catch(() => null)
  if (!detail) notFound()

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">编辑样本</h1>
        <p className="text-sm text-muted-foreground">{detail.sample.batchNo ?? "未编号"}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>样本信息</CardTitle>
          <CardDescription>接收与状态字段只能通过详情页的动作推进。</CardDescription>
        </CardHeader>
        <CardContent>
          <SampleForm sample={detail.sample} />
        </CardContent>
      </Card>
    </div>
  )
}
