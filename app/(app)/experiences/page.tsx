import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { type UserRole as UserRoleValue } from "@/lib/enums"
import { getAnalytics } from "@/lib/analytics/service"
import { BarStat, LineStat, type ChartDatum } from "@/components/analytics/charts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const dynamic = "force-dynamic"

export default async function ExperiencesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const a = await getAnalytics({ id: session.user.id, role: session.user.role as UserRoleValue })

  const monthData: ChartDatum[] = a.completedByMonth.map((m) => ({ name: m.month, value: m.count }))
  const speciesData: ChartDatum[] = a.speciesDist.map((s) => ({ name: s.name, value: s.count }))
  const tissueData: ChartDatum[] = a.tissueDist.map((s) => ({ name: s.name, value: s.count }))
  const cellsData: ChartDatum[] = a.capturedCellsBySpecies.map((s) => ({ name: s.name, value: s.avg }))
  const cellsN = a.capturedCellsBySpecies.reduce((s, x) => s + x.n, 0)

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">经验库</h1>
        <p className="text-sm text-muted-foreground">
          趋势、构成与上机产出参考（共 {a.sampleTotal} 个样本，按你的可见范围统计）。
        </p>
      </div>

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
