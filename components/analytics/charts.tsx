"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

const HEIGHT = 220

function Empty() {
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
      暂无数据
    </div>
  )
}

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--foreground)",
  boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
} as const

const axisProps = {
  tickLine: false,
  axisLine: false,
  fontSize: 12,
  stroke: "var(--muted-foreground)",
} as const

export type ChartDatum = { name: string; value: number }

/** 柱状统计（物种/组织分布、捕获细胞数等） */
export function BarStat({
  data,
  color = "var(--chart-1)",
  valueName = "数量",
}: {
  data: ChartDatum[]
  color?: string
  valueName?: string
}) {
  if (!data.length || data.every((d) => d.value === 0)) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="name" interval={0} {...axisProps} />
        <YAxis allowDecimals={false} width={44} {...axisProps} />
        <Tooltip cursor={{ fill: "var(--accent)" }} contentStyle={tooltipStyle} />
        <Bar dataKey="value" name={valueName} fill={color} radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** 折线趋势（按月完成等） */
export function LineStat({
  data,
  color = "var(--chart-1)",
  valueName = "数量",
}: {
  data: ChartDatum[]
  color?: string
  valueName?: string
}) {
  if (!data.length) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="name" {...axisProps} />
        <YAxis allowDecimals={false} width={44} {...axisProps} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line
          type="monotone"
          dataKey="value"
          name={valueName}
          stroke={color}
          strokeWidth={2}
          dot={{ r: 3, fill: color }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
