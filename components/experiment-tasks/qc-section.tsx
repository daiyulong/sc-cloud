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
  concentration: number | null
  viability: number | null
  aggregationRate: number | null
  qcResult: string
  riskLevel: string
  reason: string | null
  feedback: string | null
  createdAt: Date | string
  createdByUser: { name: string | null }
}

type QcSectionProps = {
  taskId: string
  taskNo: string
  status: ExperimentTaskStatusValue
  role?: string
  records: QcRecordView[]
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
      {label} <span className="font-medium text-foreground tabular-nums">{value}{suffix}</span>
    </span>
  )
}

/** 质控记录区：展示既有记录 + 录入入口（进行中/待提交结果/已完成可录，已完成为补录，§6.6 一任务可多条） */
export function QcSection({ taskId, taskNo, status, role, records }: QcSectionProps) {
  const { run, isPending } = useEntityAction()
  const [editing, setEditing] = React.useState(false)
  const canRecord = canRecordQc(status, role)

  function onConfirm(body: QcRecordBody) {
    run(`/api/experiment-tasks/${taskId}/qc`, "录入质控", body, () => setEditing(false))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">质控记录</h3>
        {canRecord && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing((value) => !value)}
            disabled={isPending}
          >
            <ClipboardCheck data-icon="inline-start" aria-hidden="true" />
            {editing ? "收起质控" : "录入质控"}
          </Button>
        )}
      </div>

      {editing && (
        <QcInlineForm
          taskNo={taskNo}
          isPending={isPending}
          onCancel={() => setEditing(false)}
          onConfirm={onConfirm}
        />
      )}

      {records.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无质控记录。</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {records.map((record) => (
            <li key={record.id} className="rounded-md border p-3">
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
                record.aggregationRate !== null) && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {metric("浓度", record.concentration)}
                  {metric("活率", record.viability, "%")}
                  {metric("结团率", record.aggregationRate, "%")}
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
          ))}
        </ul>
      )}

    </div>
  )
}

function QcInlineForm({
  taskNo,
  isPending,
  onCancel,
  onConfirm,
}: {
  taskNo: string
  isPending: boolean
  onCancel: () => void
  onConfirm: (body: QcRecordBody) => void
}) {
  const [concentration, setConcentration] = React.useState("")
  const [viability, setViability] = React.useState("")
  const [aggregationRate, setAggregationRate] = React.useState("")
  const [qcResult, setQcResult] = React.useState<QCResultValue>(QCResult.passed)
  const [riskLevel, setRiskLevel] = React.useState<RiskLevelValue>(RiskLevel.normal)
  const [reason, setReason] = React.useState("")
  const [feedback, setFeedback] = React.useState("")

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onConfirm({
      concentration: concentration.trim() || null,
      viability: viability.trim() || null,
      aggregationRate: aggregationRate.trim() || null,
      qcResult,
      riskLevel,
      reason: reason.trim() || null,
      feedback: feedback.trim() || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md bg-muted/30 p-4">
      <FieldGroup className="gap-4">
        <p className="text-sm text-muted-foreground">
          {taskNo} · 结构化保存质量判断，不改变任务执行状态。
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="qc-inline-concentration">悬液浓度</FieldLabel>
            <Input
              id="qc-inline-concentration"
              type="number"
              min={0}
              step="any"
              value={concentration}
              onChange={(event) => setConcentration(event.target.value)}
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
              onChange={(event) => setViability(event.target.value)}
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
              onChange={(event) => setAggregationRate(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>质控结论</FieldLabel>
            <Select
              value={qcResult}
              onValueChange={(value) => setQcResult(value as QCResultValue)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {Object.values(QCResult).map((value) => (
                    <SelectItem key={value} value={value}>
                      {QC_RESULT_LABELS[value]}
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
              onValueChange={(value) => setRiskLevel(value as RiskLevelValue)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {Object.values(RiskLevel).map((value) => (
                    <SelectItem key={value} value={value}>
                      {RISK_LEVEL_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="qc-inline-reason">不通过原因</FieldLabel>
            <Input
              id="qc-inline-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="活率低 / 结团严重 / 样本污染…"
            />
          </Field>
          <Field className="sm:col-span-3">
            <FieldLabel htmlFor="qc-inline-feedback">反馈内容</FieldLabel>
            <Textarea
              id="qc-inline-feedback"
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              placeholder="对客户或内部的说明…"
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            取消
          </Button>
          <Button type="submit" disabled={isPending}>
            录入质控
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}
