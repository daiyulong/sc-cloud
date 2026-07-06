// 产出指标的纯数据形态与取值逻辑。
// 刻意不带 "use client"：server 组件（全页 / 工作项面板）直接调用 pickRunMetrics，
// 放进 client 模块会被当作 client reference、server 端调用即报错。

export type RunMetricsView = {
  suspensionType: string | null
  sequencingAmount: number | null
  capturedCells: number | null
  medianGenes: number | null
  cellAnnotation: string | null
}

const EMPTY_METRICS: RunMetricsView = {
  suspensionType: null,
  sequencingAmount: null,
  capturedCells: null,
  medianGenes: null,
  cellAnnotation: null,
}

/**
 * 产出指标已迁到样本叶子（一行一捕获）。M1 单样本任务取其唯一叶子；
 * 多样本任务（M2）逐叶展示前先用首叶占位。
 */
export function pickRunMetrics(
  taskSamples: { sample: Partial<RunMetricsView> }[] | undefined
): RunMetricsView {
  const leaf = taskSamples?.[0]?.sample
  if (!leaf) return EMPTY_METRICS
  return {
    suspensionType: leaf.suspensionType ?? null,
    sequencingAmount: leaf.sequencingAmount ?? null,
    capturedCells: leaf.capturedCells ?? null,
    medianGenes: leaf.medianGenes ?? null,
    cellAnnotation: leaf.cellAnnotation ?? null,
  }
}
