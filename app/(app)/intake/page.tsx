import Link from "next/link"
import { Microscope, SearchX } from "lucide-react"
import { redirect } from "next/navigation"
import { getVerifiedSession } from "@/lib/auth/verified-session"
import { parsePagination } from "@/lib/api-utils"
import {
  SAMPLE_BATCH_STATUS_LABELS,
  SampleBatchStatus,
  type SampleBatchStatus as SampleBatchStatusValue,
  type UserRole as UserRoleValue,
} from "@/lib/enums"
import { buildProjectScope } from "@/lib/auth/role-scope"
import { prisma } from "@/lib/prisma"
import { sampleListQuerySchema } from "@/lib/schemas/sample"
import { getSampleDetail, listSamples } from "@/lib/samples/service"
import { firstParam, formatDate, formatDateTime } from "@/lib/utils"
import { ClickableRow } from "@/components/list/clickable-row"
import { ListEmpty } from "@/components/list/list-empty"
import { ListPager } from "@/components/list/list-pager"
import { ListToolbar } from "@/components/list/list-toolbar"
import { DetailSheet, DetailSheetEmpty } from "@/components/detail/detail-sheet"
import { SampleActionMenu } from "@/components/samples/sample-action-menu"
import { SampleSheetBody } from "@/components/samples/sample-sheet-body"
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

type IntakePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

// 批次终态（收样后冻结）：默认浏览队列时隐藏，聚焦「待到样」。搜索或显式勾选则照常显示。
const TERMINAL_BATCH_STATUSES: SampleBatchStatusValue[] = [
  SampleBatchStatus.received,
  SampleBatchStatus.received_abnormal,
]
const DEFAULT_BATCH_STATUS_SELECTION: SampleBatchStatusValue[] = (
  Object.values(SampleBatchStatus) as SampleBatchStatusValue[]
).filter((status) => !TERMINAL_BATCH_STATUSES.includes(status))

export default async function IntakePage({ searchParams }: IntakePageProps) {
  const session = await getVerifiedSession()
  if (!session) redirect("/login")

  const raw = (await searchParams) ?? {}
  const viewId = firstParam(raw.view)
  const query = sampleListQuerySchema.parse({
    q: firstParam(raw.q),
    status: firstParam(raw.status),
    projectId: firstParam(raw.projectId),
    received: firstParam(raw.received),
    page: firstParam(raw.page),
    limit: firstParam(raw.limit),
  })
  const { page, limit, skip } = parsePagination({
    page: firstParam(raw.page),
    limit: firstParam(raw.limit),
  })

  // 状态多选：未显式勾选且非 received 队列时默认隐藏终态（聚焦待到样）。received=1 队列要看已接收批次，
  // 叠加"隐藏终态"会清空它，故此时不注入默认。
  const hasStatusFilter = Boolean(query.status?.length)
  const useStatusDefault = !hasStatusFilter && !query.received
  const selectedStatuses = hasStatusFilter
    ? (query.status as SampleBatchStatusValue[])
    : useStatusDefault
      ? DEFAULT_BATCH_STATUS_SELECTION
      : undefined
  const effectiveQuery = { ...query, status: selectedStatuses }

  const [{ data: samples, total }, contextProject] = await Promise.all([
    listSamples(
      { id: session.user.id, role: session.user.role as UserRoleValue },
      effectiveQuery,
      { skip, limit }
    ),
    // 上下文 chip 的项目号：不从结果集取（结果为空时会退化成裸 ID）；未知/缺失角色 fail-closed 时回退显示裸 ID
    query.projectId
      ? prisma.project.findFirst({
          where: {
            AND: [
              { id: query.projectId },
              buildProjectScope(session.user.role as UserRoleValue),
            ],
          },
          select: { projectNo: true },
        })
      : null,
  ])
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const baseParams = new URLSearchParams()
  for (const key of ["q", "status", "projectId", "received"]) {
    const value = firstParam(raw[key])
    if (value) baseParams.set(key, value)
  }
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams(baseParams)
    params.set("page", String(nextPage))
    params.set("limit", String(limit))
    return `/intake?${params.toString()}`
  }
  // ?view=<id> 抽屉：保留当前筛选/页，叠加 view 参数
  const viewHref = (id: string) => {
    const params = new URLSearchParams(baseParams)
    if (page > 1) params.set("page", String(page))
    params.set("view", id)
    return `/intake?${params.toString()}`
  }
  const viewDetail = viewId
    ? await getSampleDetail(
        { id: session.user.id, role: session.user.role as UserRoleValue },
        viewId
      ).catch(() => null)
    : null
  // projectId 是上下文不是筛选，不参与「无匹配结果」判定
  const hasActiveFilters = Boolean(query.q || hasStatusFilter)
  const clearFiltersHref = query.projectId
    ? `/intake?projectId=${query.projectId}`
    : "/intake"

  return (
    <div className="group/list flex flex-1 flex-col gap-4 p-4 md:p-6">
      <h1 className="sr-only">收样</h1>
      <ListToolbar
        basePath="/intake"
        searchPlaceholder="搜索样品编号 / 物种 / 组织 / 项目…"
        searchDefault={query.q}
        filters={[
          {
            key: "status",
            label: "样本状态",
            allLabel: "全部状态",
            multiple: true,
            value: (selectedStatuses ?? []).join(","),
            options: Object.values(SampleBatchStatus).map((value) => ({
              value,
              label: SAMPLE_BATCH_STATUS_LABELS[value],
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
      ></ListToolbar>

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
            title={
              query.projectId
                ? "该项目暂无样本"
                : useStatusDefault
                  ? "暂无待到样批次"
                  : "暂无样本"
            }
            description={
              useStatusDefault
                ? "默认仅显示「待到样」。点上方「样本状态」可查看含已接收的全部。"
                : "样本随项目创建生成，到样时由收样员登记接收。"
            }
          />
        )
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border bg-card transition-opacity group-has-[[data-pending]]/list:opacity-60">
            <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
              <TableHeader>
                <TableRow>
                  <TableHead>样本编号 (YP)</TableHead>
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
                  <ClickableRow key={sample.id} href={viewHref(sample.id)} scroll={false}>
                    <TableCell>
                      <Link
                        href={viewHref(sample.id)}
                        scroll={false}
                        className="font-medium hover:underline"
                      >
                        {sample.batchNo ?? "未编号"}
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
                          className={SAMPLE_STATUS_DOT[sample.status as SampleBatchStatusValue]}
                        />
                        {SAMPLE_BATCH_STATUS_LABELS[sample.status as SampleBatchStatusValue]}
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(sample.expectedArrivalDate)}</TableCell>
                    <TableCell>{formatDateTime(sample.receivedAt)}</TableCell>
                    <TableCell>
                      <UserCell user={sample.receiver} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <SampleActionMenu
                          sampleId={sample.id}
                          sampleNo={sample.batchNo ?? "未编号"}
                          status={sample.status as SampleBatchStatusValue}
                          role={session.user.role}
                          projectId={sample.project.id}
                          projectNo={sample.project.projectNo ?? undefined}
                          expectedArrival={formatDate(sample.expectedArrivalDate)}
                          species={sample.species}
                          tissueType={sample.tissueType}
                          experimentType={sample.experimentType}
                          transportCondition={sample.transportCondition}
                          sampleCount={sample.sampleCount}
                          compact
                          surface="sheet"
                        />
                      </div>
                    </TableCell>
                  </ClickableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ListPager total={total} page={page} totalPages={totalPages} noun="样本" hrefFor={pageHref} />
        </>
      )}

      {viewId && (
        <DetailSheet title={viewDetail ? `样本 ${viewDetail.sample.batchNo ?? "未编号"}` : "样本详情"}>
          {viewDetail ? (
            <SampleSheetBody detail={viewDetail} role={session.user.role} />
          ) : (
            <DetailSheetEmpty message="样本不存在或无权限查看。" />
          )}
        </DetailSheet>
      )}
    </div>
  )
}
