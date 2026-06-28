"use client"

import * as React from "react"
import {
  QC_RESULT_LABELS,
  QCResult,
  RISK_LEVEL_LABELS,
  RiskLevel,
  type QCResult as QCResultValue,
  type RiskLevel as RiskLevelValue,
} from "@/lib/enums"
import { ActionOverlay, type ActionSurface } from "@/components/detail/action-overlay"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
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

export type QcRecordBody = {
  concentration: string | null
  viability: string | null
  aggregationRate: string | null
  qcResult: QCResultValue
  riskLevel: RiskLevelValue
  reason: string | null
  feedback: string | null
}

type QcDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskNo: string
  isPending: boolean
  onConfirm: (body: QcRecordBody) => void
  surface?: ActionSurface
}

/** 录入质控表单：浓度/活率/结团率 + 结论 + 风险等级 + 原因/反馈（与任务执行态正交） */
export function QcDialog({ open, onOpenChange, taskNo, isPending, onConfirm, surface }: QcDialogProps) {
  const [concentration, setConcentration] = React.useState("")
  const [viability, setViability] = React.useState("")
  const [aggregationRate, setAggregationRate] = React.useState("")
  const [qcResult, setQcResult] = React.useState<QCResultValue>(QCResult.passed)
  const [riskLevel, setRiskLevel] = React.useState<RiskLevelValue>(RiskLevel.normal)
  const [reason, setReason] = React.useState("")
  const [feedback, setFeedback] = React.useState("")
  const [prevOpen, setPrevOpen] = React.useState(open)

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setConcentration("")
      setViability("")
      setAggregationRate("")
      setQcResult(QCResult.passed)
      setRiskLevel(RiskLevel.normal)
      setReason("")
      setFeedback("")
    }
  }

  function handleConfirm() {
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
    <ActionOverlay
      surface={surface}
      open={open}
      onOpenChange={onOpenChange}
      title="录入质控"
      description={`${taskNo} · 结构化保存质量判断`}
      className="sm:max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            录入质控
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <Field>
              <FieldLabel htmlFor="qc-concentration">悬液浓度</FieldLabel>
              <Input
                id="qc-concentration"
                type="number"
                min={0}
                step="any"
                value={concentration}
                onChange={(event) => setConcentration(event.target.value)}
                placeholder="个/ul"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="qc-viability">活率 %</FieldLabel>
              <Input
                id="qc-viability"
                type="number"
                min={0}
                max={100}
                step="any"
                value={viability}
                onChange={(event) => setViability(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="qc-aggregation">结团率 %</FieldLabel>
              <Input
                id="qc-aggregation"
                type="number"
                min={0}
                max={100}
                step="any"
                value={aggregationRate}
                onChange={(event) => setAggregationRate(event.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel>质控结论</FieldLabel>
              <Select value={qcResult} onValueChange={(value) => setQcResult(value as QCResultValue)}>
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
          </div>
          <Field>
            <FieldLabel htmlFor="qc-reason">不通过原因</FieldLabel>
            <Input
              id="qc-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="活率低 / 结团严重 / 细胞凋亡 / 样本污染…"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="qc-feedback">反馈内容</FieldLabel>
            <Textarea
              id="qc-feedback"
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              placeholder="对客户或内部的说明…"
            />
          </Field>
        </div>
    </ActionOverlay>
  )
}
