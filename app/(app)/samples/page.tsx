import Link from "next/link"
import { Microscope, Plus, SearchX } from "lucide-react"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { parsePagination } from "@/lib/api-utils"
import {
  SAMPLE_STATUS_LABELS,
  SampleStatus,
  type SampleStatus as SampleStatusValue,
  type UserRole as UserRoleValue,
} from "@/lib/enums"
import { buildProjectScope } from "@/lib/auth/role-scope"
import { prisma } from "@/lib/prisma"
import { sampleListQuerySchema } from "@/lib/schemas/sample"
import { sampleCreateRoles } from "@/lib/samples/rules"
import { listSamples } from "@/lib/samples/service"
import { formatDate, formatDateTime } from "@/lib/utils"
import { ClickableRow } from "@/components/list/clickable-row"
import { ListEmpty } from "@/components/list/list-empty"
import { ListToolbar } from "@/components/list/list-toolbar"
import { SampleActionMenu } from "@/components/samples/sample-action-menu"
import { SAMPLE_STATUS_DOT, StatusDot } from "@/components/status-dot"
import { UserCell } from "@/components/user-cell"
import { Button } from "@/components/ui/button"
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
  const [{ data: samples, total }, contextProject] = await Promise.all([
    listSamples(
      { id: session.user.id, role: session.user.role as UserRoleValue },
      query,
      { skip, limit }
    ),
    // 上下文 chip 的项目号：不从结果集取（结果为空时会退化成裸 ID）；叠加行级 scope，越权时回退显示裸 ID
    query.projectId
      ? prisma.project.findFirst({
          where: {
            AND: [
              { id: query.projectId },
              buildProjectScope(session.user.role as UserRoleValue, session.user.id),
            ],
          },
          select: { projectNo: true },
        })
      : null,
  ])
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
  const createHref = query.projectId
    ? `/samples/new?projectId=${query.projectId}`
    : "/samples/new"
  // projectId 是上下文不是筛选，不参与「无匹配结果」判定
  const hasActiveFilters = Boolean(query.q || query.status)
  const clearFiltersHref = query.projectId
    ? `/samples?projectId=${query.projectId}`
    : "/samples"

  return (
    <div className="group/list flex flex-1 flex-col gap-4 p-4 md:p-6">
      <h1 className="sr-only">样本接收</h1>
      <ListToolbar
        basePath="/samples"
        searchPlaceholder="搜索样品编号 / 物种 / 组织 / 项目…"
        searchDefault={query.q}
        filters={[
          {
            key: "status",
            label: "样本状态",
            allLabel: "全部状态",
            value: query.status,
            options: Object.values(SampleStatus).map((value) => ({
              value,
              label: SAMPLE_STATUS_LABELS[value],
              dot: SAMPLE_STATUS_DOT[value],
            })),
          },
        ]}
        context={
          query.projectId
            ? {
                label: `项目：${contextProject?.projectNo ?? query.projectId}`,
                clearKeys: ["projectId"],
              }
            : undefined
        }
      >
        {canCreate && (
          <Button asChild>
            <Link href={createHref}>
              <Plus data-icon="inline-start" aria-hidden="true" />
              登记样本
            </Link>
          </Button>
        )}
      </ListToolbar>

      {total === 0 ? (
        hasActiveFilters ? (
          <ListEmpty
            icon={<SearchX />}
            title="无匹配结果"
            description="当前筛选条件下没有样本，调整或清除筛选后重试。"
          >
            <Button variant="outline" asChild>
              <Link href={clearFiltersHref}>清除筛选</Link>
            </Button>
          </ListEmpty>
        ) : (
          <ListEmpty
            icon={<Microscope />}
            title={query.projectId ? "该项目暂无样本" : "暂无样本"}
            description="登记样本后，可在到样时执行接收并跟踪状态。"
          >
            {canCreate && (
              <Button asChild>
                <Link href={createHref}>
                  <Plus data-icon="inline-start" aria-hidden="true" />
                  登记样本
                </Link>
              </Button>
            )}
          </ListEmpty>
        )
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border bg-card transition-opacity group-has-[[data-pending]]/list:opacity-60">
            <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
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
                  <ClickableRow key={sample.id} href={`/samples/${sample.id}`}>
                    <TableCell>
                      <Link
                        href={`/samples/${sample.id}`}
                        className="font-medium hover:underline"
                      >
                        {sample.sampleNo}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/projects/${sample.project.id}`}
                        className="hover:underline"
                      >
                        {sample.project.projectNo}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {sample.species} · {sample.tissueType}
                    </TableCell>
                    <TableCell>{sample.experimentType}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <StatusDot
                          className={SAMPLE_STATUS_DOT[sample.status as SampleStatusValue]}
                        />
                        {SAMPLE_STATUS_LABELS[sample.status as SampleStatusValue]}
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(sample.expectedArrivalDate)}</TableCell>
                    <TableCell>{formatDateTime(sample.receivedAt)}</TableCell>
                    <TableCell>
                      <UserCell user={sample.receiver} />
                    </TableCell>
                    <TableCell className="text-right">
                      <SampleActionMenu
                        sampleId={sample.id}
                        sampleNo={sample.sampleNo}
                        status={sample.status as SampleStatusValue}
                        role={session.user.role}
                        compact
                      />
                    </TableCell>
                  </ClickableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              共 {total} 个样本 · 第 {page} / {totalPages} 页
            </p>
            <div className="flex items-center gap-2">
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
          </div>
        </>
      )}
    </div>
  )
}
