import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => {
  const prisma = {
    user: { findFirst: vi.fn() },
    experimentTask: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  }
  return { prisma }
})

vi.mock("@/lib/operation-log", () => ({
  recordOperation: vi.fn(),
}))

vi.mock("@/lib/projects/aggregation", () => ({
  advanceProjectStatus: vi.fn(),
}))

vi.mock("@/lib/notify/task-reminder", () => ({
  notifyBioinfoTaskAssigned: vi.fn(),
}))

import { prisma } from "@/lib/prisma"
import { recordOperation } from "@/lib/operation-log"
import { advanceProjectStatus } from "@/lib/projects/aggregation"
import { notifyBioinfoTaskAssigned } from "@/lib/notify/task-reminder"
import { submitExperimentFeedback } from "@/lib/experiment-tasks/service"
import { ExperimentTaskStatus, ProjectStatus, ResultStatus, SampleStatus } from "@/lib/enums"

const OPERATOR = { id: "lab-1", role: "lab_operator" as const }

function makeTaskBefore() {
  return {
    id: "exp-current",
    taskNo: "BP-G26001-E02",
    projectId: "project-1",
    status: ExperimentTaskStatus.waiting_feedback,
    actualDate: null,
    project: {
      id: "project-1",
      projectNo: "BP-G26001",
      customerOrg: "测试客户",
      customerName: "客户X",
      status: ProjectStatus.lab_in_progress,
      serviceLevel: "standard",
      salesOwnerId: null,
    },
    taskSamples: [
      {
        sample: {
          id: "sample-1",
          sampleName: "YP-1",
          species: "人",
          tissueType: "肺",
          status: SampleStatus.lab_in_progress,
          suspensionType: null,
          sequencingAmount: null,
          capturedCells: null,
          medianGenes: null,
          batch: { batchNo: "YP-1", receivedAt: new Date("2026-06-01") },
        },
      },
    ],
    operator: null,
  }
}

describe("submitExperimentFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("含生信服务的项目在实验全部完成后自动补建生信任务并提醒指定分析员", async () => {
    const before = makeTaskBefore()
    const updated = {
      ...before,
      status: ExperimentTaskStatus.completed,
      resultStatus: ResultStatus.normal_run,
      resultFeedback: "正常上机",
      actualDate: new Date("2026-06-10"),
    }
    const txMock = {
      experimentTask: {
        update: vi.fn().mockResolvedValue(updated),
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([{ id: "exp-old" }, { id: "exp-current" }]),
      },
      sample: {
        update: vi.fn().mockResolvedValue({ id: "sample-1", status: SampleStatus.feedback_submitted }),
      },
      bioinfoTask: {
        count: vi.fn().mockResolvedValue(0),
        create: vi
          .fn()
          .mockResolvedValueOnce({
            id: "bioinfo-1",
            taskNo: "BP-G26001-B01",
            projectId: "project-1",
            experimentTaskId: "exp-old",
            analysisType: "标准分析",
            analystId: "bio-1",
            project: { projectNo: "BP-G26001", customerOrg: "测试客户" },
            analyst: { name: "生信一", email: "bio@example.com" },
          })
          .mockResolvedValueOnce({
            id: "bioinfo-2",
            taskNo: "BP-G26001-B02",
            projectId: "project-1",
            experimentTaskId: "exp-current",
            analysisType: "标准分析",
            analystId: "bio-1",
            project: { projectNo: "BP-G26001", customerOrg: "测试客户" },
            analyst: { name: "生信一", email: "bio@example.com" },
          }),
      },
    }

    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "bio-1" } as never)
    vi.mocked(prisma.experimentTask.findUnique).mockResolvedValue(before as never)
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn) => (fn as unknown as (tx: typeof txMock) => Promise<unknown>)(txMock)
    )

    const result = await submitExperimentFeedback(OPERATOR, "exp-current", {
      resultStatus: ResultStatus.normal_run,
      resultFeedback: "正常上机",
      actualDate: null,
      bioinfoAnalystId: "bio-1",
    })

    expect(result).toBe(updated)
    expect(txMock.experimentTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: "project-1",
          status: ExperimentTaskStatus.completed,
          bioinfoTasks: { none: {} },
        }),
      })
    )
    expect(txMock.bioinfoTask.create).toHaveBeenCalledTimes(2)
    expect(txMock.bioinfoTask.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        taskNo: "BP-G26001-B01",
        experimentTaskId: "exp-old",
        analysisType: "标准分析",
        analystId: "bio-1",
      })
    )
    expect(txMock.bioinfoTask.create.mock.calls[1][0].data.taskNo).toBe("BP-G26001-B02")
    expect(advanceProjectStatus).toHaveBeenCalledWith(
      txMock,
      OPERATOR,
      before.project,
      "project-1",
      ProjectStatus.waiting_bioinfo,
      "experiment_task:BP-G26001-E02:feedback"
    )
    expect(notifyBioinfoTaskAssigned).toHaveBeenCalledTimes(2)
    expect(recordOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        tx: txMock,
        entityType: "bioinfo_task",
        action: "create",
        operatorId: "lab-1",
      })
    )
  })
})
