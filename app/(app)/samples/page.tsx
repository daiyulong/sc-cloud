import Link from "next/link"
import { Plus, X } from "lucide-react"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { parsePagination } from "@/lib/api-utils"
import {
  SAMPLE_STATUS_LABELS,
  SampleStatus,
  type SampleStatus as SampleStatusValue,
  type UserRole as UserRoleValue,
} from "@/lib/enums"
import { sampleListQuerySchema } from "@/lib/schemas/sample"
import { sampleCreateRoles } from "@/lib/samples/rules"
import { listSamples } from "@/lib/samples/service"
import { formatDate, formatDateTime } from "@/lib/utils"
import { SampleFilters } from "@/components/samples/sample-filters"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const dynamic = "force-dynamic"

type SamplesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function sampleStatusBadgeVariant(status: SampleStatusValue) {
  if (status === SampleStatus.abnormal) return "destructive" as const
  if (status === SampleStatus.received_abnormal) return "outline" as const
  return "secondary" as const
}

export default async function SamplesPage({ searchParams }: SamplesPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const raw = (await searchParams) ?? {}
  const query = sampleListQuerySchema.parse({
    q: first(raw.q),
    status: first(raw.status),
    projectId: first(raw.projectId),
    page: first(raw.page),
    limit: first(raw.limit),
  })
  const { page, limit, skip } = parsePagination({
    page: first(raw.page),
    limit: first(raw.limit),
  })
  const { data: samples, total } = await listSamples(
    { id: session.user.id, role: session.user.role as UserRoleValue },
    query,
    { skip, limit }
  )
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const baseParams = new URLSearchParams()
  for (const key of ["q", "status", "projectId"]) {
    const value = first(raw[key])
    if (value) baseParams.set(key, value)
  }
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams(baseParams)
    params.set("page", String(nextPage))
    params.set("limit", String(limit))
    return `/samples?${params.toString()}`
  }
  const canCreate = sampleCreateRoles.includes(
    session.user.role as (typeof sampleCreateRoles)[number]
  )
  const projectFiltered = samples.length > 0 && query.projectId ? samples[0].project : null

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-normal">样本接收</h1>
          <p className="text-sm text-muted-foreground">
            样本登记、到样接收与异常记录。
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link
              href={
                query.projectId ? `/samples/new?projectId=${query.projectId}` : "/samples/new"
              }
            >
              <Plus data-icon="inline-start" aria-hidden="true" />
              登记样本
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>筛选</CardTitle>
          <CardDescription>服务端会自动叠加当前角色的数据可见范围</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {query.projectId && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">
                项目筛选：{projectFiltered ? projectFiltered.projectNo : query.projectId}
              </Badge>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/samples">
                  <X data-icon="inline-start" aria-hidden="true" />
                  清除
                </Link>
              </Button>
            </div>
          )}
          <SampleFilters
            initial={{
              q: query.q,
              status: query.status,
              projectId: query.projectId,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>样本列表</CardTitle>
          <CardDescription>
            共 {total} 个样本，第 {page} / {totalPages} 页
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>样品编号</TableHead>
                <TableHead>所属项目</TableHead>
                <TableHead>物种 / 组织</TableHead>
                <TableHead>实验类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>预计到样</TableHead>
                <TableHead>实际接收</TableHead>
                <TableHead>接收人</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {samples.map((sample) => (
                <TableRow key={sample.id}>
                  <TableCell className="font-medium">{sample.sampleNo}</TableCell>
                  <TableCell>
                    <Link
                      href={`/projects/${sample.project.id}`}
                      className="flex flex-col hover:underline"
                    >
                      <span>{sample.project.projectNo}</span>
                      <span className="text-xs text-muted-foreground">
                        {sample.project.customerOrg}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{sample.species}</span>
                      <span className="text-xs text-muted-foreground">{sample.tissueType}</span>
                    </div>
                  </TableCell>
                  <TableCell>{sample.experimentType}</TableCell>
                  <TableCell>
                    <Badge variant={sampleStatusBadgeVariant(sample.status as SampleStatusValue)}>
                      {SAMPLE_STATUS_LABELS[sample.status as SampleStatusValue]}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(sample.expectedArrivalDate)}</TableCell>
                  <TableCell>{formatDateTime(sample.receivedAt)}</TableCell>
                  <TableCell>{sample.receiver?.name ?? "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/samples/${sample.id}`}>详情</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {samples.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    暂无样本
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="mt-4 flex items-center justify-end gap-2">
            {page <= 1 ? (
              <Button variant="outline" size="sm" disabled>
                上一页
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href={pageHref(page - 1)}>上一页</Link>
              </Button>
            )}
            {page >= totalPages ? (
              <Button variant="outline" size="sm" disabled>
                下一页
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href={pageHref(page + 1)}>下一页</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
