/**
 * 工位状态桶:把 status enum 映射成「待办 / 进行中 / 已完成」三桶供状态 Tab 用。
 *
 * 这是状态 Tab 的语义基础,与 scope 控件(我的/团队)正交,见 ADR-0003。
 * 各工位的桶边界由这里集中维护,避免散落到多个 page.tsx。
 *
 * 注:`abnormal` 在 /lab、/bioinfo、/intake 都归「已完成」终态,
 *      在 /projects(项目视角)归「待办」中独立表达为「需关注」置顶分组,
 *      不与本页桶对齐 —— 见 ADR-0003 §"projects 的 abnormal 不入 tab 桶"。
 */
import {
  BioinfoTaskStatus,
  ExperimentTaskStatus,
  ProjectStatus,
  SampleBatchStatus,
  type BioinfoTaskStatus as BioinfoTaskStatusValue,
  type ExperimentTaskStatus as ExperimentTaskStatusValue,
  type ProjectStatus as ProjectStatusValue,
  type SampleBatchStatus as SampleBatchStatusValue,
} from "@/lib/enums"

export const BUCKETS = ["todo", "doing", "done"] as const
export type Bucket = (typeof BUCKETS)[number]

export const BUCKET_LABELS: Record<Bucket, string> = {
  todo: "待办",
  doing: "进行中",
  done: "已完成",
}

/* ---- Experiment Task ---- */
export const EXPERIMENT_TASK_BUCKETS: Record<
  ExperimentTaskStatusValue,
  Bucket
> = {
  waiting_schedule: "todo",
  scheduled: "doing",
  in_progress: "doing",
  waiting_feedback: "doing",
  completed: "done",
  cancelled: "done",
  abnormal: "done",
}

/* ---- Bioinfo Task ---- */
export const BIOINFO_TASK_BUCKETS: Record<BioinfoTaskStatusValue, Bucket> = {
  pending: "todo",
  in_progress: "doing",
  waiting_review: "doing",
  waiting_delivery: "doing",
  delivered: "done",
  abnormal: "done",
}

/* ---- Sample Batch (intake) ---- */
export const SAMPLE_BATCH_BUCKETS: Record<SampleBatchStatusValue, Bucket> = {
  waiting_arrival: "todo",
  received: "done",
  received_abnormal: "done",
}

/** /intake 只有待办 + 已完成两桶,放在前端 ListTabs 中不必渲染 "doing" */
export const INTAKE_BUCKETS: ReadonlyArray<Exclude<Bucket, "doing">> = [
  "todo",
  "done",
]

/* ---- Project ---- */
export const PROJECT_BUCKETS: Record<ProjectStatusValue, Bucket> = {
  draft: "todo",
  waiting_sample: "todo",
  sample_received: "doing",
  lab_in_progress: "doing",
  waiting_bioinfo: "doing",
  bioinfo_in_progress: "doing",
  waiting_delivery: "doing",
  completed: "done",
  abnormal: "todo", // 需主动处理,语义上是待办;但单独走 ATTENTION_STATUSES 置顶
  terminated: "done",
}

/**
 * 给出 status → bucket 映射表 + 目标桶,返回该桶下所有 status 值(供 service 层 where 输入)。
 * 列表 = Object.keys 过滤结果;空数组即桶不存在(如 /intake 没有 "doing")。
 */
export function statusesInBucket<T extends string>(
  buckets: Record<T, Bucket>,
  bucket: Bucket,
): T[] {
  return (Object.entries(buckets) as [T, Bucket][])
    .filter(([, b]) => b === bucket)
    .map(([k]) => k)
}

/** 一个 status value 落到哪个桶;类型无关 */
export function bucketOf<T extends string>(
  buckets: Record<T, Bucket>,
  status: T,
): Bucket {
  return buckets[status]
}

// 类型守卫:确认 string 是合法 Bucket
export function isBucket(value: unknown): value is Bucket {
  return typeof value === "string" && (BUCKETS as readonly string[]).includes(value)
}

// 桶 → 中文 label;供页面渲染
export function labelOf(bucket: Bucket): string {
  return BUCKET_LABELS[bucket]
}

// 抑制 lint:enums 字段全部参与
const _ensureEnumsUsed: Record<
  ExperimentTaskStatusValue & BioinfoTaskStatusValue & SampleBatchStatusValue & ProjectStatusValue,
  true
> = {} as never
void _ensureEnumsUsed
// 抑制 ExperimentalTaskStatus 等常量参与不到 ts unused 误报
void [ExperimentTaskStatus, BioinfoTaskStatus, SampleBatchStatus, ProjectStatus]
