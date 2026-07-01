"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CalendarPlus } from "lucide-react"
import * as React from "react"
import {
  EXPERIMENT_TASK_STATUS_LABELS,
  type ExperimentTaskStatus as ExperimentTaskStatusValue,
} from "@/lib/enums"
import {
  buildScheduleWindow,
  countScheduleTasksByDate,
  scheduleLoadLabel,
  scheduleLoadLevel,
  type ExperimentScheduleAppointmentBatch,
  type ExperimentScheduleTask,
} from "@/lib/experiment-tasks/lab-schedule"
import { cn, formatDate, todayString } from "@/lib/utils"
import { EXPERIMENT_TASK_STATUS_DOT, StatusDot } from "@/components/status-dot"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

type ExperimentScheduleBoardProps = {
  tasks: ExperimentScheduleTask[]
  appointmentBatches?: ExperimentScheduleAppointmentBatch[]
  selectedDate?: string
  canCreate: boolean
}

const loadBadgeClass = {
  idle: "border-border text-muted-foreground",
  normal: "border-primary/25 bg-primary/10 text-primary",
  busy: "border-chart-4/40 bg-chart-4/15 text-foreground",
  full: "border-destructive/25 bg-destructive/10 text-destructive",
}

const loadBarClass = {
  idle: "bg-muted",
  normal: "bg-primary",
  busy: "bg-chart-4",
  full: "bg-destructive",
}

function dateLabel(date: string) {
  return formatDate(`${date}T00:00:00`, {
    month: "long",
    day: "numeric",
    weekday: "short",
  })
}

function dayLabel(date: string) {
  return formatDate(`${date}T00:00:00`, {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  })
}

function loadWidth(count: number) {
  if (count <= 0) return "8%"
  return `${Math.min(100, Math.max(24, (count / 6) * 100))}%`
}

function normalizeScheduleParams(params: URLSearchParams) {
  params.set("range", "pending")
  params.delete("mode")
  params.delete("page")
  params.delete("q")
  params.delete("status")
  params.delete("operatorId")
  params.delete("awaiting")
  params.delete("date")
}

export function ExperimentScheduleBoard({
  tasks,
  appointmentBatches = [],
  selectedDate,
  canCreate,
}: ExperimentScheduleBoardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeDate = selectedDate || todayString()
  const today = todayString()

  const counts = React.useMemo(() => countScheduleTasksByDate(tasks), [tasks])
  const defaultWindow = React.useMemo(() => buildScheduleWindow(today, 14), [today])
  const dayKeys = React.useMemo(
    () => (defaultWindow.includes(activeDate) ? defaultWindow : buildScheduleWindow(activeDate, 14)),
    [activeDate, defaultWindow]
  )
  const activeTasks = React.useMemo(
    () => tasks.filter((task) => task.plannedDate === activeDate),
    [activeDate, tasks]
  )
  const appointmentCount = appointmentBatches.length
  const activeCount = counts.get(activeDate) ?? 0
  const activeLevel = scheduleLoadLevel(activeCount)

  function navigate(updates: Record<string, string | null>, replace = true) {
    const params = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key)
      else params.set(key, value)
    }
    normalizeScheduleParams(params)
    params.delete("new")
    const href = `${pathname}?${params.toString()}`
    if (replace) router.replace(href, { scroll: false })
    else router.push(href, { scroll: false })
  }

  function newTaskHref(date: string, sampleBatchId: string) {
    const params = new URLSearchParams(searchParams)
    normalizeScheduleParams(params)
    params.set("plannedDate", date)
    params.set("new", "1")
    params.set("sampleBatchId", sampleBatchId)
    params.delete("view")
    return `${pathname}?${params.toString()}`
  }

  return (
    <section className="overflow-hidden rounded-lg border bg-card transition-opacity group-has-[[data-pending]]/list:opacity-60">
      <div className="border-b p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">14 天排期负载</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              未来 14 天 · 待预约 {appointmentCount} 批 · 当前日已排 {activeCount} 项
            </p>
          </div>
          <Badge variant="outline" className={cn("w-fit", loadBadgeClass[activeLevel])}>
            {dateLabel(activeDate)} · {scheduleLoadLabel(activeCount)}
          </Badge>
        </div>

        <div className="mt-4 overflow-x-auto">
          <div className="grid min-w-[980px] grid-cols-[repeat(14,minmax(0,1fr))] gap-2">
            {dayKeys.map((date) => {
              const count = counts.get(date) ?? 0
              const level = scheduleLoadLevel(count)
              const selected = date === activeDate
              return (
                <button
                  key={date}
                  type="button"
                  className={cn(
                    "flex min-h-28 flex-col rounded-md border bg-background p-2 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    selected && "border-primary bg-accent ring-2 ring-primary/20"
                  )}
                  onClick={() => navigate({ plannedDate: date, view: null })}
                >
                  <span className={cn("text-xs font-medium", selected && "text-primary")}>
                    {dayLabel(date)}
                  </span>
                  {date === today && (
                    <Badge variant="secondary" className="mt-1 w-fit">
                      今天
                    </Badge>
                  )}
                  <span className="mt-auto text-lg font-semibold">{count}</span>
                  <span className="text-xs text-muted-foreground">项已排</span>
                  <span className="mt-2 h-1.5 rounded-full bg-muted">
                    <span
                      className={cn("block h-full rounded-full", loadBarClass[level])}
                      style={{ width: loadWidth(count) }}
                    />
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid min-h-[480px] lg:max-h-[calc(100vh-18rem)] lg:grid-cols-[minmax(0,1fr)_24rem] lg:overflow-hidden">
        <section className="min-w-0 p-4 lg:overflow-y-auto">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium">待预约批次</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                共 {appointmentCount} 批，按批次整批预约。
              </p>
            </div>
            <Badge variant="secondary">{appointmentCount}</Badge>
          </div>

          {appointmentBatches.length === 0 ? (
            <p className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
              暂无待预约批次。
            </p>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {appointmentBatches.map((batch) => (
                <div key={batch.id} className="rounded-md border bg-background p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {batch.batchNo ?? "未编号批次"}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {batch.projectNo} · {batch.customerOrg}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {batch.experimentType ?? "未填类型"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    可预约样本 {batch.sampleCount} 个 · 到样日期 {formatDate(batch.receivedAt)}
                  </p>
                  {canCreate && (
                    <Button asChild size="sm" className="mt-3 w-full">
                      <Link href={newTaskHref(activeDate, batch.id)} scroll={false}>
                        <CalendarPlus data-icon="inline-start" aria-hidden="true" />
                        预约到 {formatDate(`${activeDate}T00:00:00`, { month: "numeric", day: "numeric" })}
                      </Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="border-t bg-muted/20 p-4 lg:overflow-y-auto lg:border-t-0 lg:border-l">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium">{dateLabel(activeDate)}</h3>
              <p className="mt-1 text-xs text-muted-foreground">已排期 {activeTasks.length} 项</p>
            </div>
            <Badge variant="outline" className={cn(loadBadgeClass[activeLevel])}>
              {scheduleLoadLabel(activeCount)}
            </Badge>
          </div>

          <Separator className="mb-3" />

          {activeTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">当天暂无已排期实验任务。</p>
          ) : (
            <div className="flex flex-col gap-3">
              {activeTasks.map((task) => {
                const status = task.status as ExperimentTaskStatusValue
                return (
                  <button
                    key={task.id}
                    type="button"
                    className="min-w-0 rounded-md border bg-background px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    onClick={() => navigate({ plannedDate: activeDate, view: task.id }, false)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{task.taskNo}</span>
                      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                        <StatusDot className={EXPERIMENT_TASK_STATUS_DOT[status]} />
                        {EXPERIMENT_TASK_STATUS_LABELS[status]}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {task.experimentType} · {task.operatorName ?? "未指派"}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {task.sampleNames.length > 0
                        ? `${task.sampleNames.join("、")} · ${task.sampleCount} 个样本`
                        : task.sampleCount > 0
                          ? `${task.sampleCount} 个样本（未命名）`
                          : "—"}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
