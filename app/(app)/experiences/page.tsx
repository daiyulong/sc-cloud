import Link from "next/link"
import { redirect } from "next/navigation"
import { firstParam } from "@/lib/utils"
import {
  SUSPENSION_TYPE_LABELS,
  SuspensionType,
  type SuspensionType as SuspensionTypeValue,
  type UserRole as UserRoleValue,
} from "@/lib/enums"
import { getVerifiedSession } from "@/lib/auth/verified-session"
import {
  getAnalytics,
  hasSimilarFilters,
  searchSimilarRuns,
  type SimilarFilters,
  type SimilarStat,
} from "@/lib/analytics/service"
import { BarStat, LineStat, type ChartDatum } from "@/components/analytics/charts"
import { SimilarSearch } from "@/components/analytics/similar-search"
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

type ExperiencesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function Stat({ label, stat, suffix = "" }: { label: string; stat: SimilarStat; suffix?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {stat ? (
        <span className="text-lg font-semibold tabular-nums">
          {stat.median}
          {suffix}
          <span className="ml-1 text-xs font-normal text-muted-foreground">n={stat.n}</span>
        </span>
      ) : (
        <span className="text-lg font-semibold text-muted-foreground">—</span>
      )}
    </div>
  )
}

export default async function ExperiencesPage({ searchParams }: ExperiencesPageProps) {
  const session = await getVerifiedSession()
  if (!session) redirect("/login")
  const operator = { id: session.user.id, role: session.user.role as UserRoleValue }

  const raw = (await searchParams) ?? {}
  const rawSuspension = firstParam(raw.suspensionType)
  const filters: SimilarFilters = {
    species: firstParam(raw.species),
    tissue: firstParam(raw.tissue),
    runMethod: firstParam(raw.runMethod),
    suspensionType:
      rawSuspension === SuspensionType.cell || rawSuspension === SuspensionType.nucleus
        ? (rawSuspension as SuspensionTypeValue)
        : undefined,
  }

  const [a, similar] = await Promise.all([
    getAnalytics(operator),
    searchSimilarRuns(operator, filters),
  ])

  const monthData: ChartDatum[] = a.completedByMonth.map((m) => ({ name: m.month, value: m.count }))
  const speciesData: ChartDatum[] = a.speciesDist.map((s) => ({ name: s.name, value: s.count }))
  const tissueData: ChartDatum[] = a.tissueDist.map((s) => ({ name: s.name, value: s.count }))
  const cellsData: ChartDatum[] = a.capturedCellsBySpecies.map((s) => ({ name: s.name, value: s.avg }))
  const cellsN = a.capturedCellsBySpecies.reduce((s, x) => s + x.n, 0)
  const filtered = hasSimilarFilters(filters)

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <h1 className="sr-only">经验库</h1>

      <Card>
        <CardHeader>
          <CardTitle>相似经验检索</CardTitle>
          <CardDescription>按物种 / 组织 / 建库化学匹配历史上机产出，估算这类样本可期望的指标。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <SimilarSearch
            initial={{
              species: filters.species,
              tissue: filters.tissue,
              runMethod: filters.runMethod,
              suspensionType: filters.suspensionType,
            }}
          />
          <div className="grid grid-cols-2 gap-4 rounded-lg border bg-muted/30 px-4 py-3 sm:grid-cols-4">
            <Stat label="匹配上机" stat={{ median: similar.total, n: similar.total }} />
            <Stat label="捕获细胞数（中位）" stat={similar.capturedCells} />
            <Stat label="基因中位数（中位）" stat={similar.medianGenes} />
            <Stat label="活率（中位）" stat={similar.viability} suffix="%" />
          </div>

          {similar.total === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {filtered ? "无匹配的历史上机，放宽条件再试。" : "暂无有产出指标的历史上机记录。"}
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table className="[&_td]:px-3 [&_td]:py-2 [&_th]:px-3">
                <TableHeader>
                  <TableRow>
                    <TableHead>任务</TableHead>
                    <TableHead>物种 / 组织</TableHead>
                    <TableHead>建库化学</TableHead>
                    <TableHead>悬液</TableHead>
                    <TableHead className="text-right">捕获细胞数</TableHead>
                    <TableHead className="text-right">基因中位数</TableHead>
                    <TableHead className="text-right">活率</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {similar.runs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link href={`/lab?view=${r.id}`} className="font-medium hover:underline">
                          {r.taskNo}
                        </Link>
                        <span className="block text-xs text-muted-foreground">{r.projectNo ?? "—"}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {(r.species ?? "—") + " / " + (r.tissueType ?? "—")}
                      </TableCell>
                      <TableCell>{r.runMethod ?? "—"}</TableCell>
                      <TableCell>
                        {r.suspensionType
                          ? SUSPENSION_TYPE_LABELS[r.suspensionType as SuspensionTypeValue]
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.capturedCells ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.medianGenes ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.viability != null ? `${r.viability}%` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>完成项目趋势</CardTitle>
          <CardDescription>近 6 个月按交付月份统计</CardDescription>
        </CardHeader>
        <CardContent>
          <LineStat data={monthData} valueName="完成数" />
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>物种分布</CardTitle>
            <CardDescription>按样本物种（Top 8，脏值原样）</CardDescription>
          </CardHeader>
          <CardContent>
            <BarStat data={speciesData} color="var(--chart-2)" valueName="样本数" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>组织类型分布</CardTitle>
            <CardDescription>按样本组织类型（Top 8，脏值原样）</CardDescription>
          </CardHeader>
          <CardContent>
            <BarStat data={tissueData} color="var(--chart-3)" valueName="样本数" />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>捕获细胞数 · 按物种均值</CardTitle>
          <CardDescription>
            上机产出参考{cellsN > 0 ? `（样本 ${cellsN}）` : "（暂无产出指标，实验完成补录后显示）"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BarStat data={cellsData} color="var(--chart-4)" valueName="平均捕获细胞数" />
        </CardContent>
      </Card>
    </div>
  )
}
