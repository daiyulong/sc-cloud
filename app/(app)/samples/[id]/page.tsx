import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Edit } from "lucide-react"
import { auth } from "@/lib/auth"
import {
  PROJECT_STATUS_LABELS,
  SAMPLE_STATUS_LABELS,
  SampleStatus,
  type ProjectStatus as ProjectStatusValue,
  type SampleStatus as SampleStatusValue,
  type UserRole as UserRoleValue,
} from "@/lib/enums"
import { getSampleDetail } from "@/lib/samples/service"
import { OperationTimeline } from "@/components/detail/operation-timeline"
import { SampleActionMenu } from "@/components/samples/sample-action-menu"
import { SampleFields } from "@/components/samples/sample-fields"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const dynamic = "force-dynamic"

type SampleDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function SampleDetailPage({ params }: SampleDetailPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params
  const detail = await getSampleDetail(
    { id: session.user.id, role: session.user.role as UserRoleValue },
    id
  ).catch(() => null)
  if (!detail) notFound()

  const { sample, operationLogs } = detail
  const status = sample.status as SampleStatusValue

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal">{sample.sampleNo}</h1>
            <Badge variant={status === SampleStatus.abnormal ? "destructive" : "secondary"}>
              {SAMPLE_STATUS_LABELS[status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            <Link href={`/projects/${sample.project.id}`} className="hover:underline">
              {sample.project.projectNo}
            </Link>{" "}
            · {sample.project.customerOrg} ·{" "}
            {PROJECT_STATUS_LABELS[sample.project.status as ProjectStatusValue]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SampleActionMenu
            sampleId={sample.id}
            sampleNo={sample.sampleNo}
            status={status}
            role={session.user.role}
          />
          <Button asChild variant="outline">
            <Link href={`/samples/${sample.id}/edit`}>
              <Edit data-icon="inline-start" aria-hidden="true" />
              编辑
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>样本信息</CardTitle>
          <CardDescription>登记与接收的核心字段</CardDescription>
        </CardHeader>
        <CardContent>
          <SampleFields sample={sample} columns={3} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>时间线</CardTitle>
          <CardDescription>来自操作日志</CardDescription>
        </CardHeader>
        <CardContent>
          <OperationTimeline logs={operationLogs} />
        </CardContent>
      </Card>
    </div>
  )
}
