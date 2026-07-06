"use client"

import { ClipboardCheck } from "lucide-react"
import * as React from "react"
import {
  QCResult,
  QC_RESULT_LABELS,
  RiskLevel,
  RISK_LEVEL_LABELS,
  type ExperimentTaskStatus as ExperimentTaskStatusValue,
  type QCResult as QCResultValue,
  type RiskLevel as RiskLevelValue,
} from "@/lib/enums"
import { canRecordQc } from "@/lib/experiment-tasks/rules"
import { formatDateTime } from "@/lib/utils"
import { useEntityAction } from "@/components/detail/use-entity-action"
import type { QcRecordBody } from "@/components/experiment-tasks/types"
import { Badge } from "@/components/ui/badge"
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

export type QcRecordView = {
  id: string
  sampleId: string
  sample: { id: string; sampleName: string | null }
  concentration: number | null
  viability: number | null
  aggregationRate: number | null
  volume: number | null
  qcResult: string
  riskLevel: string
  reason: string | null
  feedback: string | null
  createdAt: Date | string
  createdByUser: { name: string | null }
}

/** 样本叶子形态（用于按样本名单独录入质控） */
export type QcLeafSample = {
  id: string
  sampleName: string | null
}

type QcSectionProps = {
  taskId: string
  taskNo: string
  status: ExperimentTaskStatusValue
  role?: string
  records: QcRecordView[]
  /** 任务关联的样本叶子，用于按样本名分组展示与选择录入 */
  taskSamples: QcLeafSample[]
}

const RESULT_BADGE: Record<QCResultValue, "default" | "secondary" | "destructive"> = {
  passed: "default",
  low_risk_passed: "secondary",
  failed: "destructive",
}

function metric(label: string, value: number | null, suffix = "") {
  if (value === null || value === undefined) return null
  return (
    <span className="text-xs text-muted-foreground">
      {label}{" "}
      <span className="font-medium text-foreground tabular-nums">
        {value}
        {suffix}
      </span>
    </span>
  )
}

function RecordItem({ record }: { record: QcRecordView }) {
  return (
    <li className="rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={RESULT_BADGE[record.qcResult as QCResultValue]}>
          {QC_RESULT_LABELS[record.qcResult as QCResultValue]}
        </Badge>
        <span className="text-xs text-muted-foreground">
          风险 {RISK_LEVEL_LABELS[record.riskLevel as RiskLevelValue]}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {record.createdByUser.name} · {formatDateTime(record.createdAt)}
        </span>
      </div>
      {(record.concentration !== null ||
        record.viability !== null ||
        record.aggregationRate !== null ||
        record.volume !== null) && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {metric("浓度", record.concentration)}
          {metric("活率", record.viability, "%")}
          {metric("结团率", record.aggregationRate, "%")}
          {metric("体积", record.volume, "mL")}
        </div>
      )}
      {record.reason && (
        <p className="mt-2 text-sm">
          <span className="text-muted-foreground">原因：</span>
          {record.reason}
        </p>
      )}
      {record.feedback && (
        <p className="mt-1 text-sm">
          <span className="text-muted-foreground">反馈：</span>
          {record.feedback}
        </p>
      )}
    </li>
  )
}

/** 质控记录区：按样本名分组展示，每组可单独录入（需求 2026-07） */
export function QcSection({
  taskId,
  taskNo,
  status,
  role,
  records,
  taskSamples,
}: QcSectionProps) {
  const { run, isPending } = useEntityAction()
  const [editingSampleId, setEditingSampleId] = React.useState<string | null>(null)
  const canRecord = canRecordQc(status, role)

  // 按 sample.id 分组（records 中 sampleId 是外键，sample.id 是叶子主键）
  const grouped = React.useMemo(() => {
    const map = new Map<string, QcRecordView[]>()
    for (const r of records) {
      const key = r.sample.id
      const list = map.get(key) ?? []
      list.push(r)
      map.set(key, list)
    }
    return map
  }, [records])

  function onConfirm(sampleId: string, body: QcRecordBody) {
    run(`/api/experiment-tasks/${taskId}/qc`, "录入质控", body, () =>
      setEditingSampleId(null)
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">质控记录</h3>
      </div>

      {taskSamples.length === 0 && records.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无质控记录。</p>
      ) : (
        <div className="flex flex-col gap-3">
          {taskSamples.map((leaf) => {
            const leafRecords = grouped.get(leaf.id) ?? []
            const isEditing = editingSampleId === leaf.id
            const leafName = leaf.sampleName || "未命名"
            const hasRecords = leafRecords.length > 0

            return (
              <div key={leaf.id} className="rounded-md border">
                {/* 样本头 */}
                <div className="flex items-center justify-between border-b bg-muted/20 px-3 py-2">
                  <span className="text-sm font-medium">{leafName}</span>
                  {canRecord && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setEditingSampleId(isEditing ? null : leaf.id)
                      }
                      disabled={isPending}
                    >
                      <ClipboardCheck
                        data-icon="inline-start"
                        aria-hidden="true"
                        className="size-3.5"
                      />
                      {isEditing ? "收起" : hasRecords ? "追加质控" : "录入质控"}
                    </Button>
                  )}
                </div>

                {/* 录入表单 */}
                {isEditing && (
                  <div className="border-b bg-muted/30 p-3">
                    <QcInlineForm
                      taskNo={`${taskNo} · ${leafName}`}
                      isPending={isPending}
                      initialSampleId={leaf.id}
                      onCancel={() => setEditingSampleId(null)}
                      onConfirm={(body) => onConfirm(leaf.id, body)}
                    />
                  </div>
                )}

                {/* 已有记录列表 */}
                {hasRecords ? (
                  <ul className="flex flex-col divide-y">
                    {leafRecords.map((r) => (
                      <li key={r.id} className="p-3">
                        <RecordItem record={r} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  !isEditing && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      暂无质控记录
                    </p>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function QcInlineForm({
  taskNo,
  isPending,
  initialSampleId,
  onCancel,
  onConfirm,
}: {
  taskNo: string
  isPending: boolean
  initialSampleId: string
  onCancel: () => void
  onConfirm: (body: QcRecordBody) => void
}) {
  const [sampleId] = React.useState(initialSampleId)
  const [concentration, setConcentration] = React.useState("")
  const [viability, setViability] = React.useState("")
  const [aggregationRate, setAggregationRate] = React.useState("")
  const [volume, setVolume] = React.useState("")
  const [qcResult, setQcResult] = React.useState<QCResultValue>(QCResult.passed)
  const [riskLevel, setRiskLevel] = React.useState<RiskLevelValue>(RiskLevel.normal)
  const [reason, setReason] = React.useState("")
  const [feedback, setFeedback] = React.useState("")

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onConfirm({
      sampleId,
      concentration: concentration.trim() || null,
      viability: viability.trim() || null,
      aggregationRate: aggregationRate.trim() || null,
      volume: volume.trim() || null,
      qcResult,
      riskLevel,
      reason: reason.trim() || null,
      feedback: feedback.trim() || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {taskNo} · 结构化保存质量判断，不改变任务执行状态。
      </p>
      <FieldGroup className="grid gap-3 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="qc-inline-concentration">悬液浓度</FieldLabel>
          <Input
            id="qc-inline-concentration"
            type="number"
            min={0}
            step="any"
            value={concentration}
            onChange={(e) => setConcentration(e.target.value)}
            placeholder="个/ul"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="qc-inline-viability">活率 %</FieldLabel>
          <Input
            id="qc-inline-viability"
            type="number"
            min={0}
            max={100}
            step="any"
            value={viability}
            onChange={(e) => setViability(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="qc-inline-aggregation">结团率 %</FieldLabel>
          <Input
            id="qc-inline-aggregation"
            type="number"
            min={0}
            max={100}
            step="any"
            value={aggregationRate}
            onChange={(e) => setAggregationRate(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="qc-inline-volume">体积 mL</FieldLabel>
          <Input
            id="qc-inline-volume"
            type="number"
            min={0}
            step="any"
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            placeholder="mL"
          />
        </Field>
        <Field>
          <FieldLabel>质控结论</FieldLabel>
          <Select
            value={qcResult}
            onValueChange={(v) => setQcResult(v as QCResultValue)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Object.values(QCResult).map((v) => (
                  <SelectItem key={v} value={v}>
                    {QC_RESULT_LABELS[v]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>风险等级</FieldLabel>
          <Select
            value={riskLevel}
            onValueChange={(v) => setRiskLevel(v as RiskLevelValue)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Object.values(RiskLevel).map((v) => (
                  <SelectItem key={v} value={v}>
                    {RISK_LEVEL_LABELS[v]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field className="sm:col-span-3">
          <FieldLabel htmlFor="qc-inline-reason">不通过原因</FieldLabel>
          <Input
            id="qc-inline-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="活率低 / 结团严重 / 样本污染…"
          />
        </Field>
        <Field className="sm:col-span-3">
          <FieldLabel htmlFor="qc-inline-feedback">反馈内容</FieldLabel>
          <Textarea
            id="qc-inline-feedback"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="对客户或内部的说明…"
            className="min-h-16 resize-y"
          />
        </Field>
      </FieldGroup>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          取消
        </Button>
        <Button type="submit" disabled={isPending}>
          录入质控
        </Button>
      </div>
    </form>
  )
}
