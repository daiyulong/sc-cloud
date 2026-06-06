"use client"

import { ClipboardCheck } from "lucide-react"
import * as React from "react"
import {
  QC_RESULT_LABELS,
  RISK_LEVEL_LABELS,
  type ExperimentTaskStatus as ExperimentTaskStatusValue,
  type QCResult as QCResultValue,
  type RiskLevel as RiskLevelValue,
} from "@/lib/enums"
import { getAvailableExperimentTaskActions } from "@/lib/experiment-tasks/rules"
import { formatDateTime } from "@/lib/utils"
import { useEntityAction } from "@/components/detail/use-entity-action"
import { QcDialog, type QcRecordBody } from "@/components/experiment-tasks/qc-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

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

/** 质控记录区：展示既有记录 + 录入入口（进行中/待反馈可录，§6.6 一任务可多条） */
export function QcSection({ taskId, taskNo, status, role, records }: QcSectionProps) {
  const { run, isPending } = useEntityAction()
  const [open, setOpen] = React.useState(false)
  const canRecord = getAvailableExperimentTaskActions(status, role).includes("qc")

  function onConfirm(body: QcRecordBody) {
    run(`/api/experiment-tasks/${taskId}/qc`, "录入质控", body, () => setOpen(false))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">质控记录</h3>
        {canRecord && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={isPending}>
            <ClipboardCheck data-icon="inline-start" aria-hidden="true" />
            录入质控
          </Button>
        )}
      </div>

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

      <QcDialog
        open={open}
        onOpenChange={setOpen}
        taskNo={taskNo}
        isPending={isPending}
        onConfirm={onConfirm}
      />
    </div>
  )
}
