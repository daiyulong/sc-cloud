import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QcSection } from "@/components/experiment-tasks/qc-section"
import { ExperimentTaskStatus, UserRole } from "@/lib/enums"

const fetchMock = vi.fn(
  async () => new Response(JSON.stringify({ ok: true }), { status: 200 })
)

beforeEach(() => {
  fetchMock.mockClear()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("QcSection", () => {
  it("进行中 + 实验员：面板内展开质控表单并提交", async () => {
    const user = userEvent.setup()
    render(
      <QcSection
        taskId="t1"
        taskNo="BP-G26001-E01"
        status={ExperimentTaskStatus.in_progress}
        role={UserRole.lab_operator}
        records={[]}
        taskSamples={[{ id: "s1", sampleName: "样本-001" }]}
      />
    )

    await user.click(screen.getByRole("button", { name: "录入质控" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("活率 %"), { target: { value: "90" } })
    await user.click(screen.getByRole("button", { name: "录入质控" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("/api/experiment-tasks/t1/qc")
    const body = JSON.parse(String(init.body))
    expect(body.qcResult).toBe("passed")
    expect(body.viability).toBe("90")
    expect(body.sampleId).toBe("s1")
  })

  it("viewer：不显示录入入口", () => {
    render(
      <QcSection
        taskId="t1"
        taskNo="BP-G26001-E01"
        status={ExperimentTaskStatus.in_progress}
        role={UserRole.viewer}
        records={[]}
        taskSamples={[{ id: "s1", sampleName: "样本-001" }]}
      />
    )

    expect(screen.queryByRole("button", { name: "录入质控" })).not.toBeInTheDocument()
  })
})
