import type {
  QCResult,
  RiskLevel,
} from "@/lib/enums"

/** 实验员/分析员下拉选项的统一形态（共享于 form + work-item-body） */
export type OperatorOption = { id: string; name: string; department: string | null }

export type FeedbackAnalystOption = { id: string; name: string; department: string | null }

/** 实验质控录入提交形态（qc-section.onConfirm + service层 form 表单）；需求 2026-07：volume 新增，sampleId 必填 */
export type QcRecordBody = {
  sampleId: string
  concentration: string | null
  viability: string | null
  aggregationRate: string | null
  volume: string | null
  qcResult: QCResult
  riskLevel: RiskLevel
  reason: string | null
  feedback: string | null
}

/** 下机指标录入提交形态（run-metrics-section.onConfirm + 表单内部收集）；需求 2026-07：cellAnnotation 新增 */
export type RunMetricsBody = {
  sampleId: string
  suspensionType: string | null
  sequencingAmount: string | null
  capturedCells: string | null
  medianGenes: string | null
  cellAnnotation: string | null
}
