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
import { Textarea } from "@/components/ui/textarea"

const NONE = "none"

/** 单样本叶子形态（用于按样本名分组的展示） */
export type RunMetricsLeafSample = {
  id: string
  sampleName: string | null
  metrics: RunMetricsView
}

type RunMetricsSectionProps = {
  /** 指标归属的实验任务（生信任务详情里传关联实验任务，实验任务详情里传自身） */
  experimentTaskId: string
  taskNo: string
  status: ExperimentTaskStatusValue
  role?: string
  metrics: RunMetricsView
  /** 多样本时传入（生信任务上下文），用于按样本名分组展示与录入 */
  taskSamples?: RunMetricsLeafSample[]
}


/**
 * 产出指标区（§6.8 经验视图）：展示下机定量指标 + 录入入口。
 * 两处复用——生信任务详情（分析员主录）与实验任务详情（实验员/PM 订正）。
 * 需求 2026-07：cellAnnotation 新增；多样本时按样本名分组展示与录入。
 */
export function RunMetricsSection({
  experimentTaskId,
  taskNo,
  status,
  role,
  metrics,
  taskSamples,
}: RunMetricsSectionProps) {
  const { run, isPending } = useEntityAction()
  const [editing, setEditing] = React.useState(false)
  const canRecord = canRecordRunMetrics(status, role)
  const hasAny =
    metrics.suspensionType !== null ||
    metrics.sequencingAmount !== null ||
    metrics.capturedCells !== null ||
    metrics.medianGenes !== null

  const isMultiSample = taskSamples && taskSamples.length > 1

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
          taskSamples={taskSamples}
          onCancel={() => setEditing(false)}
          onConfirm={onConfirm}
        />
      )}

      {/* 需求 2026-07：多样本时按样本名分组展示 */}
      {isMultiSample ? (
        <div className="flex flex-col gap-3">
          {taskSamples!.map((leaf) => {
            const leafHasAny =
              leaf.metrics.suspensionType !== null ||
              leaf.metrics.sequencingAmount !== null ||
              leaf.metrics.capturedCells !== null ||
              leaf.metrics.medianGenes !== null ||
              leaf.metrics.cellAnnotation !== null
            return (
              <div key={leaf.id} className="rounded-md border p-3">
                <p className="mb-2 text-xs font-medium">
                  {leaf.sampleName || "未命名"}
                </p>
                {leafHasAny ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <FieldLine
                      label="悬液类型"
                      value={
                        leaf.metrics.suspensionType
                          ? SUSPENSION_TYPE_LABELS[leaf.metrics.suspensionType as SuspensionTypeValue]
                          : "-"
                      }
                    />
                    <FieldLine label="测序量 (G)" value={leaf.metrics.sequencingAmount ?? "-"} />
                    <FieldLine label="捕获细胞数" value={leaf.metrics.capturedCells ?? "-"} />
                    <FieldLine label="基因中位数" value={leaf.metrics.medianGenes ?? "-"} />
                    <FieldLine label="细胞注释" value={leaf.metrics.cellAnnotation ?? "-"} className="sm:col-span-2" />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">暂无产出指标。</p>
                )}
              </div>
            )
          })}
        </div>
      ) : hasAny ? (
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
          <FieldLine label="细胞注释" value={metrics.cellAnnotation ?? "-"} className="sm:col-span-2" />
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
  taskSamples,
  onCancel,
  onConfirm,
}: {
  taskNo: string
  isPending: boolean
  initial: RunMetricsView
  /** 传入时表示多样本上下文（生信任务详情），表单需选择样本 */
  taskSamples?: RunMetricsLeafSample[]
  onCancel: () => void
  onConfirm: (body: RunMetricsBody) => void
}) {
  const isMultiSample = taskSamples && taskSamples.length > 1

  // 单样本/多样本已选样本时的初始值
  const initialSampleId = taskSamples?.[0]?.id ?? ""
  const [selectedSampleId, setSelectedSampleId] = React.useState(initialSampleId)

  // key 触发重挂：selectedSampleId 变化时整个 FormContent 组件重新挂载，状态自动清零，无 effect
  const formKey = isMultiSample ? selectedSampleId : "single"

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const suspensionTypeVal = (event.currentTarget.elements.namedItem("suspensionType") as HTMLSelectElement)?.value
    onConfirm({
      sampleId: selectedSampleId,
      suspensionType: suspensionTypeVal && suspensionTypeVal !== NONE ? suspensionTypeVal : null,
      sequencingAmount: (event.currentTarget.elements.namedItem("sequencingAmount") as HTMLInputElement)?.value || null,
      capturedCells: (event.currentTarget.elements.namedItem("capturedCells") as HTMLInputElement)?.value || null,
      medianGenes: (event.currentTarget.elements.namedItem("medianGenes") as HTMLInputElement)?.value || null,
      cellAnnotation: (event.currentTarget.elements.namedItem("cellAnnotation") as HTMLTextAreaElement)?.value || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md bg-muted/30 p-4">
      {/* key 使 selectedSampleId 变化时自动重挂，状态清零 */}
      <FormContent
        key={formKey}
        taskNo={taskNo}
        isMultiSample={!!isMultiSample}
        selectedSampleId={selectedSampleId}
        onSampleIdChange={setSelectedSampleId}
        taskSamples={taskSamples}
        initial={initial}
        isPending={isPending}
        onCancel={onCancel}
      />
    </form>
  )
}

function FormContent({
  taskNo,
  isMultiSample,
  selectedSampleId,
  onSampleIdChange,
  taskSamples,
  initial,
  isPending,
  onCancel,
}: {
  taskNo: string
  isMultiSample: boolean
  selectedSampleId: string
  onSampleIdChange: (id: string) => void
  taskSamples?: RunMetricsLeafSample[]
  initial: RunMetricsView
  isPending: boolean
  onCancel: () => void
}) {
  return (
    <>
      <FieldGroup className="gap-4">
        <p className="text-sm text-muted-foreground">
          {taskNo} · 下机定量后补录，供相似经验参考。
        </p>
        <div className="grid gap-4 sm:grid-cols-4">
          {isMultiSample && (
            <Field className="sm:col-span-4">
              <FieldLabel>选择样本</FieldLabel>
              <Select value={selectedSampleId} onValueChange={onSampleIdChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="请选择样本" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {taskSamples!.map((leaf) => (
                      <SelectItem key={leaf.id} value={leaf.id}>
                        {leaf.sampleName || "未命名"}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field>
            <FieldLabel>悬液类型</FieldLabel>
            <Select name="suspensionType" defaultValue={initial.suspensionType ?? NONE}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={NONE}>未指定</SelectItem>
                  {Object.values(SuspensionType).map((v) => (
                    <SelectItem key={v} value={v}>
                      {SUSPENSION_TYPE_LABELS[v]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="rm-seq">测序量 (G)</FieldLabel>
            <Input id="rm-seq" name="sequencingAmount" type="number" min={0} step="any" defaultValue={initial.sequencingAmount?.toString() ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor="rm-cells">捕获细胞数</FieldLabel>
            <Input id="rm-cells" name="capturedCells" type="number" min={0} step="1" defaultValue={initial.capturedCells?.toString() ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor="rm-genes">基因中位数</FieldLabel>
            <Input id="rm-genes" name="medianGenes" type="number" min={0} step="1" defaultValue={initial.medianGenes?.toString() ?? ""} />
          </Field>
          <Field className="sm:col-span-4">
            <FieldLabel htmlFor="rm-cell-anno">细胞注释</FieldLabel>
            <Textarea id="rm-cell-anno" name="cellAnnotation" defaultValue={initial.cellAnnotation ?? ""} placeholder="对该样本细胞类型的注释…" className="min-h-16 resize-y" />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>取消</Button>
          <Button type="submit" disabled={isPending}>保存</Button>
        </div>
      </FieldGroup>
    </>
  )
}
