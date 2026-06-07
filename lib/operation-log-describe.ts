import {
  BIOINFO_TASK_STATUS_LABELS,
  EXPERIMENT_TASK_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  SAMPLE_STATUS_LABELS,
} from "@/lib/enums"

/**
 * 把一条操作日志翻译成人类可读的标题 + 状态转移，供时间线渲染。
 * 防御性解析异构的 before/after JSON：可能是实体快照本身，也可能是
 * `{ task|project|sample|qcRecord, kind?, trigger?, reason? }` 包装（聚合级联/补录）。
 */

export type DescribableLog = {
  entityType: string
  action: string
  beforeData?: unknown
  afterData?: unknown
}

export type OperationDescription = {
  title: string
  /** 状态转移，如「待生信 → 待交付」；无则不显示 */
  transition?: string
}

const ENTITY_LABEL: Record<string, string> = {
  project: "项目",
  sample: "样本",
  experiment_task: "实验任务",
  bioinfo_task: "生信任务",
  qc_record: "质控",
  user: "用户",
}

const STATUS_LABELS: Record<string, Record<string, string>> = {
  project: PROJECT_STATUS_LABELS,
  sample: SAMPLE_STATUS_LABELS,
  experiment_task: EXPERIMENT_TASK_STATUS_LABELS,
  bioinfo_task: BIOINFO_TASK_STATUS_LABELS,
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null
}

/**
 * 剥掉聚合/补录包装，取出真正的实体快照与 kind 标记。
 * 只在出现包装标记（trigger/kind/reason）时才剥——否则快照本身就是实体，
 * 不能因为它 include 了嵌套关系（如样本快照里的 project）而误把关系当包装。
 */
function unwrap(after: unknown): { entity: Record<string, unknown> | null; kind?: string } {
  const obj = asRecord(after)
  if (!obj) return { entity: null }
  const isWrapper = "trigger" in obj || "kind" in obj || "reason" in obj
  if (!isWrapper) return { entity: obj }
  const wrapped =
    asRecord(obj.task) ?? asRecord(obj.project) ?? asRecord(obj.sample) ?? asRecord(obj.qcRecord)
  return { entity: wrapped ?? obj, kind: typeof obj.kind === "string" ? obj.kind : undefined }
}

function nameOf(entity: Record<string, unknown> | null): string {
  if (!entity) return ""
  const no = entity.sampleNo ?? entity.taskNo ?? entity.projectNo
  return typeof no === "string" && no ? ` ${no}` : ""
}

function statusLabel(entityType: string, value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  return STATUS_LABELS[entityType]?.[value] ?? value
}

export function describeOperationLog(log: DescribableLog): OperationDescription {
  const entityLabel = ENTITY_LABEL[log.entityType] ?? log.entityType
  const { entity, kind } = unwrap(log.afterData)
  const before = asRecord(log.beforeData)
  const name = nameOf(entity)

  if (kind === "run_metrics") return { title: `录入产出指标${name}` }
  if (kind === "qc_record") return { title: `录入质控${name}` }

  switch (log.action) {
    case "create":
      return { title: `创建${entityLabel}${name}` }
    case "status_change": {
      const to = statusLabel(log.entityType, entity?.status)
      const from = statusLabel(log.entityType, before?.status)
      if (from && to && from !== to) return { title: `${entityLabel}${name}`, transition: `${from} → ${to}` }
      if (to) return { title: `${entityLabel}${name}`, transition: to }
      return { title: `${entityLabel}${name} 状态变更` }
    }
    case "update":
      return { title: `更新${entityLabel}${name}` }
    case "assign":
      return { title: `指派${entityLabel}${name}` }
    case "delete":
      return { title: `删除${entityLabel}${name}` }
    default:
      return { title: `${entityLabel}${name} ${log.action}` }
  }
}
