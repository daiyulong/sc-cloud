import { describe, expect, it, vi, beforeEach } from "vitest"

// Mock 整个 prisma 模块，让 service 走 mock。
// recordOperation 同理独立 mock，让断言聚焦在 service 自身的 fan-out 与校验逻辑。
vi.mock("@/lib/prisma", () => {
  const prisma = {
    sample: {
      findMany: vi.fn(),
    },
    experimentTask: {
      count: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  }
  return { prisma }
})

vi.mock("@/lib/operation-log", () => ({
  recordOperation: vi.fn(),
}))

import { prisma } from "@/lib/prisma"
import { recordOperation } from "@/lib/operation-log"
import {
  createExperimentTaskFromSamples,
  createExperimentTaskFromSample,
} from "@/lib/experiment-tasks/service"

const OPERATOR = { id: "user-1", role: "lab_operator" as const }

function makeSample(id: string, projectId: string, projectNo: string, sampleStatus = "received") {
  return {
    id,
    projectId,
    status: sampleStatus,
    project: {
      id: projectId,
      projectNo,
      customerOrg: "测试客户",
      customerName: "客户X",
      status: "sample_received",
      serviceLevel: "standard",
      salesOwnerId: null,
    },
  }
}

describe("createExperimentTaskFromSamples (多对多入口)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("happy path：同事务内 createTask + createMany TaskSample + recordOperation", async () => {
    const txMock = {
      experimentTask: {
        count: vi.fn().mockResolvedValue(2),
        create: vi.fn().mockResolvedValue({
          id: "task-1",
          taskNo: "BP-X-E03",
          projectId: "p1",
          status: "waiting_schedule",
        }),
      },
    }
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn) => (fn as unknown as (tx: typeof txMock) => Promise<unknown>)(txMock)
    )
    vi.mocked(prisma.sample.findMany).mockResolvedValue([
      makeSample("s1", "p1", "BP-X"),
      makeSample("s2", "p1", "BP-X"),
      makeSample("s3", "p1", "BP-X"),
    ] as never)

    await createExperimentTaskFromSamples(OPERATOR, {
      experimentType: "建库",
      sampleIds: ["s1", "s2", "s3"],
    })

    // 事务闭包被以 tx 为入参执行一次
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    // taskNo 计数 + 创建走 tx
    expect(txMock.experimentTask.count).toHaveBeenCalledWith({ where: { projectId: "p1" } })
    expect(txMock.experimentTask.create).toHaveBeenCalledTimes(1)
    const createArg = txMock.experimentTask.create.mock.calls[0][0]
    expect(createArg.data.taskNo).toBe("BP-X-E03")
    // 关键：createMany TaskSample 把 3 个 ID 一次性写入
    expect(createArg.data.taskSamples).toEqual({
      createMany: { data: [{ sampleId: "s1" }, { sampleId: "s2" }, { sampleId: "s3" }] },
    })
    // recordOperation 被以 experiment_task + create 调用一次
    expect(recordOperation).toHaveBeenCalledTimes(1)
    expect(recordOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        tx: txMock,
        entityType: "experiment_task",
        action: "create",
        operatorId: "user-1",
      })
    )
  })

  it("跨项目 sampleIds 抛 400", async () => {
    vi.mocked(prisma.sample.findMany).mockResolvedValue([
      makeSample("s1", "p1", "BP-X"),
      makeSample("s2", "p2", "BP-Y"),
    ] as never)

    await expect(
      createExperimentTaskFromSamples(OPERATOR, {
        experimentType: "建库",
        sampleIds: ["s1", "s2"],
      })
    ).rejects.toMatchObject({
      name: "ExperimentTaskDomainError",
      message: expect.stringContaining("同一项目"),
      status: 400,
    })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("部分 ID 找不到 / 已上机 → 404（findMany 返回数 < 入参数）", async () => {
    // findMany 返回 1 条，但入参是 2 条 → 表示其中一个不存在 / 状态不符 / 已上机
    vi.mocked(prisma.sample.findMany).mockResolvedValue([makeSample("s1", "p1", "BP-X")] as never)

    await expect(
      createExperimentTaskFromSamples(OPERATOR, {
        experimentType: "建库",
        sampleIds: ["s1", "s2_missing"],
      })
    ).rejects.toMatchObject({
      name: "ExperimentTaskDomainError",
      status: 404,
    })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("样本状态不符（feedback_submitted 等终态）抛 409", async () => {
    vi.mocked(prisma.sample.findMany).mockResolvedValue([
      makeSample("s1", "p1", "BP-X", "received"),
      makeSample("s2", "p1", "BP-X", "feedback_submitted"),
    ] as never)

    await expect(
      createExperimentTaskFromSamples(OPERATOR, {
        experimentType: "建库",
        sampleIds: ["s1", "s2"],
      })
    ).rejects.toMatchObject({
      name: "ExperimentTaskDomainError",
      status: 409,
    })
  })

  it("项目状态不符（如 waiting_sample 未到样）抛 409", async () => {
    vi.mocked(prisma.sample.findMany).mockResolvedValue([
      {
        ...makeSample("s1", "p1", "BP-X"),
        project: { ...makeSample("s1", "p1", "BP-X").project, status: "waiting_sample" },
      },
    ] as never)

    // 模拟 findMany 也会把 status 不符的过滤掉，所以这里走 404 分支
    // 单独测试 service 内部 projectStatus 校验需要绕过 findMany filter，简化：直接传 status=draft
    vi.mocked(prisma.sample.findMany).mockResolvedValue([
      {
        ...makeSample("s1", "p1", "BP-X"),
        project: { ...makeSample("s1", "p1", "BP-X").project, status: "draft" },
      },
    ] as never)

    await expect(
      createExperimentTaskFromSamples(OPERATOR, {
        experimentType: "建库",
        sampleIds: ["s1"],
      })
    ).rejects.toMatchObject({
      name: "ExperimentTaskDomainError",
      status: 409,
    })
  })

  it("非 staff 角色抛 403", async () => {
    await expect(
      createExperimentTaskFromSamples(
        { id: "u1", role: "viewer" },
        { experimentType: "建库", sampleIds: ["s1"] }
      )
    ).rejects.toMatchObject({
      name: "ExperimentTaskDomainError",
      status: 403,
    })
    expect(prisma.sample.findMany).not.toHaveBeenCalled()
  })

  it("去重：传重复 ID 也只产生一个 TaskSample 行", async () => {
    const txMock = {
      experimentTask: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "task-2", taskNo: "BP-X-E01" }),
      },
    }
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn) => (fn as unknown as (tx: typeof txMock) => Promise<unknown>)(txMock)
    )
    // findMany 返回 2 个（去重后）
    vi.mocked(prisma.sample.findMany).mockResolvedValue([
      makeSample("s1", "p1", "BP-X"),
      makeSample("s2", "p1", "BP-X"),
    ] as never)

    await createExperimentTaskFromSamples(OPERATOR, {
      experimentType: "建库",
      sampleIds: ["s1", "s2", "s1", "s2"], // 重复
    })

    const createArg = txMock.experimentTask.create.mock.calls[0][0]
    expect(createArg.data.taskSamples).toEqual({
      createMany: { data: [{ sampleId: "s1" }, { sampleId: "s2" }] },
    })
  })

  it("填 plannedDate 时任务直接进 scheduled（不再 waiting_schedule）", async () => {
    const txMock = {
      experimentTask: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "task-3", taskNo: "BP-X-E01" }),
      },
    }
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn) => (fn as unknown as (tx: typeof txMock) => Promise<unknown>)(txMock)
    )
    vi.mocked(prisma.sample.findMany).mockResolvedValue([makeSample("s1", "p1", "BP-X")] as never)

    await createExperimentTaskFromSamples(OPERATOR, {
      experimentType: "建库",
      sampleIds: ["s1"],
      plannedDate: new Date("2026-07-01"),
    })

    const createArg = txMock.experimentTask.create.mock.calls[0][0]
    expect(createArg.data.status).toBe("scheduled")
  })

  it("project.projectNo 缺失时 taskNo 退化用 project.id", async () => {
    const txMock = {
      experimentTask: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "task-4", taskNo: "p1-E01" }),
      },
    }
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn) => (fn as unknown as (tx: typeof txMock) => Promise<unknown>)(txMock)
    )
    vi.mocked(prisma.sample.findMany).mockResolvedValue([
      {
        ...makeSample("s1", "p1", null as unknown as string),
        project: { ...makeSample("s1", "p1", "").project, projectNo: null },
      },
    ] as never)

    await createExperimentTaskFromSamples(OPERATOR, {
      experimentType: "建库",
      sampleIds: ["s1"],
    })

    const createArg = txMock.experimentTask.create.mock.calls[0][0]
    expect(createArg.data.taskNo).toBe("p1-E01")
  })
})

describe("createExperimentTaskFromSample (单样本向后兼容)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("委托到多对多入口：sampleIds=[id]", async () => {
    const txMock = {
      experimentTask: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "task-5", taskNo: "BP-X-E01" }),
      },
    }
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn) => (fn as unknown as (tx: typeof txMock) => Promise<unknown>)(txMock)
    )
    vi.mocked(prisma.sample.findMany).mockResolvedValue([makeSample("s-only", "p1", "BP-X")] as never)

    await createExperimentTaskFromSample(OPERATOR, "s-only", { experimentType: "建库" })

    const createArg = txMock.experimentTask.create.mock.calls[0][0]
    expect(createArg.data.taskSamples).toEqual({
      createMany: { data: [{ sampleId: "s-only" }] },
    })
  })
})