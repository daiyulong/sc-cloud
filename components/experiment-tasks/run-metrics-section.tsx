"use client"

import { LineChart } from "lucide-react"
import * as React from "react"
import {
  SUSPENSION_TYPE_LABELS,
  SuspensionType,
  type ExperimentTaskStatus as ExperimentTaskStatusValue,
  type SuspensionType as SuspensionTypeValue,
} from "@/lib/enums"
import { canRecordRunMetrics } from "@/lib/experiment-tasks/rules"
import { FieldLine } from "@/components/detail/field-line"
import { useEntityAction } from "@/components/detail/use-entity-action"
import type { RunMetricsView } from "@/components/experiment-tasks/run-metrics"
import type { RunMetricsBody } from "@/components/experiment-tasks/types"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const NONE = "none"

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
  const [editing, setEditing] = React.useState(false)
  const canRecord = canRecordRunMetrics(status, role)
  const hasAny =
    metrics.suspensionType !== null ||
    metrics.sequencingAmount !== null ||
    metrics.capturedCells !== null ||
    metrics.medianGenes !== null

  function onConfirm(body: RunMetricsBody) {
    run(`/api/experiment-tasks/${experimentTaskId}/run-metrics`, "录入产出指标", body, () =>
      setEditing(false)
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">产出指标</h3>
        {canRecord && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing((value) => !value)}
            disabled={isPending}
          >
            <LineChart data-icon="inline-start" aria-hidden="true" />
            {editing ? "收起指标" : hasAny ? "订正指标" : "录入指标"}
          </Button>
        )}
      </div>

      {editing && (
        <RunMetricsInlineForm
          taskNo={taskNo}
          isPending={isPending}
          initial={metrics}
          onCancel={() => setEditing(false)}
          onConfirm={onConfirm}
        />
      )}

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

    </div>
  )
}

function RunMetricsInlineForm({
  taskNo,
  isPending,
  initial,
  onCancel,
  onConfirm,
}: {
  taskNo: string
  isPending: boolean
  initial: RunMetricsView
  onCancel: () => void
  onConfirm: (body: RunMetricsBody) => void
}) {
  const [suspensionType, setSuspensionType] = React.useState(initial.suspensionType ?? NONE)
  const [sequencingAmount, setSequencingAmount] = React.useState(
    initial.sequencingAmount?.toString() ?? ""
  )
  const [capturedCells, setCapturedCells] = React.useState(initial.capturedCells?.toString() ?? "")
  const [medianGenes, setMedianGenes] = React.useState(initial.medianGenes?.toString() ?? "")
  const allEmpty =
    suspensionType === NONE &&
    sequencingAmount.trim() === "" &&
    capturedCells.trim() === "" &&
    medianGenes.trim() === ""

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onConfirm({
      suspensionType: suspensionType === NONE ? null : suspensionType,
      sequencingAmount: sequencingAmount.trim() || null,
      capturedCells: capturedCells.trim() || null,
      medianGenes: medianGenes.trim() || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md bg-muted/30 p-4">
      <FieldGroup className="gap-4">
        <p className="text-sm text-muted-foreground">
          {taskNo} · 下机定量后补录，供相似经验参考。
        </p>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field>
            <FieldLabel>悬液类型</FieldLabel>
            <Select value={suspensionType} onValueChange={setSuspensionType}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={NONE}>未指定</SelectItem>
                  {Object.values(SuspensionType).map((value) => (
                    <SelectItem key={value} value={value}>
                      {SUSPENSION_TYPE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="rm-inline-seq">测序量 (G)</FieldLabel>
            <Input
              id="rm-inline-seq"
              type="number"
              min={0}
              step="any"
              value={sequencingAmount}
              onChange={(event) => setSequencingAmount(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="rm-inline-cells">捕获细胞数</FieldLabel>
            <Input
              id="rm-inline-cells"
              type="number"
              min={0}
              step="1"
              value={capturedCells}
              onChange={(event) => setCapturedCells(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="rm-inline-genes">基因中位数</FieldLabel>
            <Input
              id="rm-inline-genes"
              type="number"
              min={0}
              step="1"
              value={medianGenes}
              onChange={(event) => setMedianGenes(event.target.value)}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            取消
          </Button>
          <Button type="submit" disabled={isPending || allEmpty}>
            保存
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}
