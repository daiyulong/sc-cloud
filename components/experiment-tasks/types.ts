import type {
  QCResult,
  RiskLevel,
} from "@/lib/enums"

/** 实验员/分析员下拉选项的统一形态（共享于 form + work-item-body） */
export type OperatorOption = { id: string; name: string; department: string | null }

export type FeedbackAnalystOption = { id: string; name: string; department: string | null }

/** 实验质控录入提交形态（qc-section.onConfirm + service层 form 表单） */
export type QcRecordBody = {
  concentration: string | null
  viability: string | null
  aggregationRate: string | null
  qcResult: QCResult
  riskLevel: RiskLevel
  reason: string | null
  feedback: string | null
}

/** 下机指标录入提交形态（run-metrics-section.onConfirm + 表单内部收集） */
export type RunMetricsBody = {
  suspensionType: string | null
  sequencingAmount: string | null
  capturedCells: string | null
  medianGenes: string | null
}
