"use client"

import { LineChart } from "lucide-react"
import * as React from "react"
import {
  SUSPENSION_TYPE_LABELS,
  type ExperimentTaskStatus as ExperimentTaskStatusValue,
  type SuspensionType as SuspensionTypeValue,
} from "@/lib/enums"
import { canRecordRunMetrics } from "@/lib/experiment-tasks/rules"
import { FieldLine } from "@/components/detail/field-line"
import { useEntityAction } from "@/components/detail/use-entity-action"
import {
  RunMetricsDialog,
  type RunMetricsBody,
} from "@/components/experiment-tasks/run-metrics-dialog"
import { Button } from "@/components/ui/button"

export type RunMetricsView = {
  suspensionType: string | null
  sequencingAmount: number | null
  capturedCells: number | null
  medianGenes: number | null
}

type RunMetricsSectionProps = {
  /** 指标归属的实验任务（生信任务详情里传关联实验任务，实验任务详情里传自身） */
  experimentTaskId: string
  taskNo: string
  status: ExperimentTaskStatusValue
  role?: string
  metrics: RunMetricsView
}

/**
 * 产出指标区（§6.8 经验视图）：展示下机定量指标 + 录入入口。
 * 两处复用——生信任务详情（分析员主录）与实验任务详情（实验员/PM 订正）。
 */
export function RunMetricsSection({
  experimentTaskId,
  taskNo,
  status,
  role,
  metrics,
}: RunMetricsSectionProps) {
  const { run, isPending } = useEntityAction()
  const [open, setOpen] = React.useState(false)
  const canRecord = canRecordRunMetrics(status, role)
  const hasAny =
    metrics.suspensionType !== null ||
    metrics.sequencingAmount !== null ||
    metrics.capturedCells !== null ||
    metrics.medianGenes !== null

  function onConfirm(body: RunMetricsBody) {
    run(`/api/experiment-tasks/${experimentTaskId}/run-metrics`, "录入产出指标", body, () =>
      setOpen(false)
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">产出指标</h3>
        {canRecord && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={isPending}>
            <LineChart data-icon="inline-start" aria-hidden="true" />
            {hasAny ? "订正指标" : "录入指标"}
          </Button>
        )}
      </div>

      {hasAny ? (
        <div className="grid grid-cols-2 gap-4">
          <FieldLine
            label="悬液类型"
            value={
              metrics.suspensionType
                ? SUSPENSION_TYPE_LABELS[metrics.suspensionType as SuspensionTypeValue]
                : "-"
            }
          />
          <FieldLine label="测序量 (G)" value={metrics.sequencingAmount ?? "-"} />
          <FieldLine label="捕获细胞数" value={metrics.capturedCells ?? "-"} />
          <FieldLine label="基因中位数" value={metrics.medianGenes ?? "-"} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">暂无产出指标（下机定量后补录）。</p>
      )}

      <RunMetricsDialog
        open={open}
        onOpenChange={setOpen}
        taskNo={taskNo}
        isPending={isPending}
        initial={metrics}
        onConfirm={onConfirm}
      />
    </div>
  )
}
