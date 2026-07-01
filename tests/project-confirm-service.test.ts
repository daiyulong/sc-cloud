import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => {
  const prisma = {
    project: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
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
import { ProjectStatus, UserRole } from "@/lib/enums"
import { confirmProject } from "@/lib/projects/service"

const OPERATOR = { id: "pm-1", role: UserRole.project_manager }

function makeDraftProject() {
  return {
    id: "project-1",
    projectNo: null,
    status: ProjectStatus.draft,
    projectManagerId: null,
    serviceLevel: "standard",
    priority: "normal",
    expectedDeliveryDate: null,
  }
}

describe("confirmProject", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("确认项目时如果缺少样本批次，同事务补建待接收批次", async () => {
    const before = makeDraftProject()
    const updated = { ...before, projectNo: "BP-G260601008", status: ProjectStatus.waiting_sample }
    const txMock = {
      project: {
        update: vi.fn().mockResolvedValue(updated),
      },
      sampleBatch: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "batch-1", projectId: "project-1", seq: 1 }),
      },
    }
    vi.mocked(prisma.project.findUnique).mockResolvedValue(before as never)
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn) => (fn as unknown as (tx: typeof txMock) => Promise<unknown>)(txMock)
    )

    await confirmProject(OPERATOR, "project-1", { projectNo: "BP-G260601008" })

    expect(txMock.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "project-1" },
        data: expect.objectContaining({
          projectNo: "BP-G260601008",
          status: ProjectStatus.waiting_sample,
        }),
      })
    )
    expect(txMock.sampleBatch.count).toHaveBeenCalledWith({ where: { projectId: "project-1" } })
    expect(txMock.sampleBatch.create).toHaveBeenCalledWith({
      data: { projectId: "project-1", seq: 1 },
    })
    expect(recordOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        tx: txMock,
        entityType: "sample_batch",
        entityId: "batch-1",
        action: "create",
      })
    )
  })

  it("已有样本批次时不重复创建", async () => {
    const before = makeDraftProject()
    const updated = { ...before, projectNo: "BP-G260601009", status: ProjectStatus.waiting_sample }
    const txMock = {
      project: {
        update: vi.fn().mockResolvedValue(updated),
      },
      sampleBatch: {
        count: vi.fn().mockResolvedValue(1),
        create: vi.fn(),
      },
    }
    vi.mocked(prisma.project.findUnique).mockResolvedValue(before as never)
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn) => (fn as unknown as (tx: typeof txMock) => Promise<unknown>)(txMock)
    )

    await confirmProject(OPERATOR, "project-1", { projectNo: "BP-G260601009" })

    expect(txMock.sampleBatch.count).toHaveBeenCalledWith({ where: { projectId: "project-1" } })
    expect(txMock.sampleBatch.create).not.toHaveBeenCalled()
  })
})
