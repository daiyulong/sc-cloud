import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => {
  const prisma = {
    sampleBatch: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  }
  return { prisma }
})

vi.mock("@/lib/operation-log", () => ({
  recordOperation: vi.fn(),
}))

import { prisma } from "@/lib/prisma"
import { SampleBatchStatus, UserRole } from "@/lib/enums"
import { updateSample } from "@/lib/samples/service"
import { SampleDomainError } from "@/lib/samples/rules"

const OPERATOR = { id: "u-1", role: UserRole.project_manager }

function makeBatch(overrides: Partial<{ samplingDate: Date | null; expectedArrivalDate: Date | null }> = {}) {
  return {
    id: "batch-1",
    status: SampleBatchStatus.waiting_arrival,
    receiverId: null,
    batchNo: null,
    species: null,
    tissueType: null,
    experimentType: null,
    transportCondition: null,
    sampleCount: null,
    samplingDate: new Date("2026-06-05T00:00:00Z"),
    expectedArrivalDate: new Date("2026-06-07T00:00:00Z"),
    abnormalNote: null,
    receivedAt: null,
    remark: null,
    project: { salesOwnerId: null },
    ...overrides,
  }
}

describe("updateSample 业务规则：预计到样不得早于取样日期（§8.6）", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("写入比 sampleDate 早的 expectedArrivalDate 抛 409，不写库", async () => {
    vi.mocked(prisma.sampleBatch.findUnique).mockResolvedValue(makeBatch() as never)
    const update = vi.fn().mockResolvedValue(null)
    vi.mocked(prisma.sampleBatch.update).mockImplementation(update)

    await expect(
      updateSample(OPERATOR, "batch-1", {
        samplingDate: new Date("2026-06-10T00:00:00Z"),
        expectedArrivalDate: new Date("2026-06-05T00:00:00Z"),
      }),
    ).rejects.toBeInstanceOf(SampleDomainError)

    expect(update).not.toHaveBeenCalled()
  })

  it("同一天放行，且在保留原 sampleDate 时只改 expectedArrivalDate 仍能守住反序", async () => {
    // 原 samplingDate=06-05，传入 expectedArrivalDate=06-04（更早），应被拒
    vi.mocked(prisma.sampleBatch.findUnique).mockResolvedValue(makeBatch() as never)
    const update = vi.fn()
    vi.mocked(prisma.sampleBatch.update).mockImplementation(update)

    await expect(
      updateSample(OPERATOR, "batch-1", {
        expectedArrivalDate: new Date("2026-06-04T00:00:00Z"),
      }),
    ).rejects.toThrow(/预计到样日期不能早于客户取样日期/)

    expect(update).not.toHaveBeenCalled()
  })
})
