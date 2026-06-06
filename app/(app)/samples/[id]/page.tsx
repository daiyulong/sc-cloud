import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Edit } from "lucide-react"
import { auth } from "@/lib/auth"
import {
  PROJECT_STATUS_LABELS,
  RECEIVE_STATUS_LABELS,
  SAMPLE_STATUS_LABELS,
  SampleStatus,
  USER_ROLE_LABELS,
  type ProjectStatus as ProjectStatusValue,
  type ReceiveStatus as ReceiveStatusValue,
  type SampleStatus as SampleStatusValue,
  type UserRole as UserRoleValue,
} from "@/lib/enums"
import { getSampleDetail } from "@/lib/samples/service"
import { formatDate, formatDateTime } from "@/lib/utils"
import { SampleActions } from "@/components/samples/sample-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export const dynamic = "force-dynamic"

type SampleDetailPageProps = {
  params: Promise<{ id: string }>
}

function FieldLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value || "-"}</span>
    </div>
  )
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
        <Button asChild variant="outline">
          <Link href={`/samples/${sample.id}/edit`}>
            <Edit data-icon="inline-start" aria-hidden="true" />
            编辑
          </Link>
        </Button>
      </div>

      <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>样本信息</CardTitle>
            <CardDescription>登记与接收的核心字段</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-3">
            <FieldLine label="样本物种" value={sample.species} />
            <FieldLine label="组织类型" value={sample.tissueType} />
            <FieldLine label="样本数量" value={sample.sampleCount ?? "-"} />
            <FieldLine label="实验类型" value={sample.experimentType} />
            <FieldLine label="运输条件" value={sample.transportCondition} />
            <FieldLine label="客户取样日期" value={formatDate(sample.samplingDate)} />
            <FieldLine label="预计到样日期" value={formatDate(sample.expectedArrivalDate)} />
            <FieldLine label="实际接收时间" value={formatDateTime(sample.receivedAt)} />
            <FieldLine label="接收人" value={sample.receiver?.name} />
            <FieldLine
              label="接收状态"
              value={RECEIVE_STATUS_LABELS[sample.receiveStatus as ReceiveStatusValue]}
            />
            <FieldLine label="异常说明" value={sample.abnormalNote} />
            <FieldLine label="创建时间" value={formatDateTime(sample.createdAt)} />
            <div className="md:col-span-3">
              <FieldLine label="备注" value={sample.remark} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>样本动作</CardTitle>
            <CardDescription>状态只能通过语义化动作推进</CardDescription>
          </CardHeader>
          <CardContent>
            <SampleActions sampleId={sample.id} status={status} role={session.user.role} />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>时间线</CardTitle>
          <CardDescription>来自操作日志</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {operationLogs.map((log) => (
            <div key={log.id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{log.action}</Badge>
                  <span className="text-sm font-medium">{log.operator.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {USER_ROLE_LABELS[log.operator.role as UserRoleValue]}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(log.createdAt)}
                </span>
              </div>
              <Separator />
            </div>
          ))}
          {operationLogs.length === 0 && (
            <p className="text-sm text-muted-foreground">暂无操作日志。</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
