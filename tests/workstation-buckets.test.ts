import { describe, expect, it } from "vitest"
import {
  BUCKETS,
  BUCKET_LABELS,
  EXPERIMENT_TASK_BUCKETS,
  BIOINFO_TASK_BUCKETS,
  SAMPLE_BATCH_BUCKETS,
  INTAKE_BUCKETS,
  PROJECT_BUCKETS,
  bucketOf,
  bucketOf as _bucketOf, // re-export sanity
  isBucket,
  labelOf,
  statusesInBucket,
  type Bucket,
} from "@/lib/workstation-buckets"
import {
  ExperimentTaskStatus,
  BioinfoTaskStatus,
  SampleBatchStatus,
  ProjectStatus,
} from "@/lib/enums"

describe("workstation-buckets 总表", () => {
  it("三桶枚举固定顺序 = todo / doing / done", () => {
    expect(BUCKETS).toEqual(["todo", "doing", "done"])
  })

  it("三桶均有中文 label", () => {
    expect(BUCKET_LABELS).toEqual({ todo: "待办", doing: "进行中", done: "已完成" })
  })

  it("isBucket 严格守卫字符串", () => {
    expect(isBucket("todo")).toBe(true)
    expect(isBucket("doing")).toBe(true)
    expect(isBucket("done")).toBe(true)
    expect(isBucket("other")).toBe(false)
    expect(isBucket(null)).toBe(false)
    expect(isBucket(0)).toBe(false)
  })

  it("labelOf 给中文", () => {
    expect(labelOf("todo")).toBe("待办")
    expect(labelOf("doing")).toBe("进行中")
    expect(labelOf("done")).toBe("已完成")
  })
})

describe("ExperimentTask 桶映射", () => {
  it("waiting_schedule 待办,scheduled/in_progress/waiting_feedback 进行中,completed/cancelled/abnormal 已完成", () => {
    expect(bucketOf(EXPERIMENT_TASK_BUCKETS, ExperimentTaskStatus.waiting_schedule)).toBe("todo")
    expect(bucketOf(EXPERIMENT_TASK_BUCKETS, ExperimentTaskStatus.scheduled)).toBe("doing")
    expect(bucketOf(EXPERIMENT_TASK_BUCKETS, ExperimentTaskStatus.in_progress)).toBe("doing")
    expect(bucketOf(EXPERIMENT_TASK_BUCKETS, ExperimentTaskStatus.waiting_feedback)).toBe("doing")
    expect(bucketOf(EXPERIMENT_TASK_BUCKETS, ExperimentTaskStatus.completed)).toBe("done")
    expect(bucketOf(EXPERIMENT_TASK_BUCKETS, ExperimentTaskStatus.cancelled)).toBe("done")
    expect(bucketOf(EXPERIMENT_TASK_BUCKETS, ExperimentTaskStatus.abnormal)).toBe("done")
  })

  it("statusesInBucket 返回桶下完整 status 列表", () => {
    expect(statusesInBucket(EXPERIMENT_TASK_BUCKETS, "todo")).toEqual(["waiting_schedule"])
    expect(statusesInBucket(EXPERIMENT_TASK_BUCKETS, "doing").sort()).toEqual(
      ["scheduled", "in_progress", "waiting_feedback"].sort(),
    )
    expect(statusesInBucket(EXPERIMENT_TASK_BUCKETS, "done").sort()).toEqual(
      ["completed", "cancelled", "abnormal"].sort(),
    )
  })

  it("7 个状态全覆盖,没有任何 status 缺漏", () => {
    const all = statusesInBucket(EXPERIMENT_TASK_BUCKETS, "todo")
      .concat(statusesInBucket(EXPERIMENT_TASK_BUCKETS, "doing"))
      .concat(statusesInBucket(EXPERIMENT_TASK_BUCKETS, "done"))
    expect(all.sort()).toEqual(Object.values(ExperimentTaskStatus).sort())
    expect(new Set(all).size).toBe(all.length)
  })
})

describe("BioinfoTask 桶映射", () => {
  it("pending 待办,3 个 waiting/in_progress 进行中,delivered/abnormal 已完成", () => {
    expect(bucketOf(BIOINFO_TASK_BUCKETS, BioinfoTaskStatus.pending)).toBe("todo")
    expect(bucketOf(BIOINFO_TASK_BUCKETS, BioinfoTaskStatus.in_progress)).toBe("doing")
    expect(bucketOf(BIOINFO_TASK_BUCKETS, BioinfoTaskStatus.waiting_review)).toBe("doing")
    expect(bucketOf(BIOINFO_TASK_BUCKETS, BioinfoTaskStatus.waiting_delivery)).toBe("doing")
    expect(bucketOf(BIOINFO_TASK_BUCKETS, BioinfoTaskStatus.delivered)).toBe("done")
    expect(bucketOf(BIOINFO_TASK_BUCKETS, BioinfoTaskStatus.abnormal)).toBe("done")
  })

  it("6 个状态全覆盖", () => {
    const all = statusesInBucket(BIOINFO_TASK_BUCKETS, "todo")
      .concat(statusesInBucket(BIOINFO_TASK_BUCKETS, "doing"))
      .concat(statusesInBucket(BIOINFO_TASK_BUCKETS, "done"))
    expect(all.sort()).toEqual(Object.values(BioinfoTaskStatus).sort())
  })
})

describe("SampleBatch(intake)桶映射", () => {
  it("waiting_arrival 待办,received/received_abnormal 已完成", () => {
    expect(bucketOf(SAMPLE_BATCH_BUCKETS, SampleBatchStatus.waiting_arrival)).toBe("todo")
    expect(bucketOf(SAMPLE_BATCH_BUCKETS, SampleBatchStatus.received)).toBe("done")
    expect(bucketOf(SAMPLE_BATCH_BUCKETS, SampleBatchStatus.received_abnormal)).toBe("done")
  })

  it("/intake 只有 2 桶,无 doing", () => {
    expect(statusesInBucket(SAMPLE_BATCH_BUCKETS, "doing")).toEqual([])
    expect(INTAKE_BUCKETS).toEqual(["todo", "done"])
    expect(INTAKE_BUCKETS).not.toContain("doing")
  })
})

describe("Project 桶映射", () => {
  it("draft/waiting_sample 待办;5 个 in-flight 进行中;completed/terminated 已完成", () => {
    expect(bucketOf(PROJECT_BUCKETS, ProjectStatus.draft)).toBe("todo")
    expect(bucketOf(PROJECT_BUCKETS, ProjectStatus.waiting_sample)).toBe("todo")
    expect(bucketOf(PROJECT_BUCKETS, ProjectStatus.sample_received)).toBe("doing")
    expect(bucketOf(PROJECT_BUCKETS, ProjectStatus.lab_in_progress)).toBe("doing")
    expect(bucketOf(PROJECT_BUCKETS, ProjectStatus.waiting_bioinfo)).toBe("doing")
    expect(bucketOf(PROJECT_BUCKETS, ProjectStatus.bioinfo_in_progress)).toBe("doing")
    expect(bucketOf(PROJECT_BUCKETS, ProjectStatus.waiting_delivery)).toBe("doing")
    expect(bucketOf(PROJECT_BUCKETS, ProjectStatus.completed)).toBe("done")
    expect(bucketOf(PROJECT_BUCKETS, ProjectStatus.terminated)).toBe("done")
  })

  it("abnormal 在 projects 工位归「待办」(需主动处理),与其他工位不一致", () => {
    // Lab / Bioinfo 的 abnormal = done;Projects 的 abnormal = todo(语义:待办)
    expect(bucketOf(EXPERIMENT_TASK_BUCKETS, "abnormal" as never)).toBe("done")
    expect(bucketOf(BIOINFO_TASK_BUCKETS, "abnormal" as never)).toBe("done")
    expect(bucketOf(PROJECT_BUCKETS, ProjectStatus.abnormal)).toBe("todo")
  })

  it("10 个项目状态全覆盖", () => {
    const all = statusesInBucket(PROJECT_BUCKETS, "todo")
      .concat(statusesInBucket(PROJECT_BUCKETS, "doing"))
      .concat(statusesInBucket(PROJECT_BUCKETS, "done"))
    expect(all.sort()).toEqual(Object.values(ProjectStatus).sort())
    expect(new Set(all).size).toBe(all.length)
  })
})

describe("API 摘要", () => {
  it("桶导出稳定:bucketOf / statusesInBucket / labelOf / isBucket", () => {
    expect(typeof bucketOf).toBe("function")
    expect(typeof statusesInBucket).toBe("function")
    expect(typeof labelOf).toBe("function")
    expect(typeof isBucket).toBe("function")
    // 类型守卫生效
    const out: Bucket = "todo"
    expect(out).toBe("todo")
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = _bucketOf
  })
})
