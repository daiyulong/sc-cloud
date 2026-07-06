import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { RunMetricsSection } from "@/components/experiment-tasks/run-metrics-section"
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

const emptyMetrics = {
  suspensionType: null,
  sequencingAmount: null,
  capturedCells: null,
  medianGenes: null,
  cellAnnotation: null,
}

const baseProps = {
  experimentTaskId: "e1",
  taskNo: "BP-G26001-E01",
  status: ExperimentTaskStatus.completed,
  role: UserRole.bioinfo_analyst,
  metrics: emptyMetrics,
}

describe("RunMetricsSection", () => {
  it("已完成 + 分析员：显示录入按钮 + 空态提示", () => {
    render(<RunMetricsSection {...baseProps} />)
    expect(screen.getByRole("button", { name: "录入指标" })).toBeInTheDocument()
    expect(screen.getByText(/暂无产出指标/)).toBeInTheDocument()
  })

  it("viewer：不显示录入按钮", () => {
    render(<RunMetricsSection {...baseProps} role={UserRole.viewer} />)
    expect(screen.queryByRole("button", { name: /指标/ })).not.toBeInTheDocument()
  })

  it("已有指标：按钮变「订正指标」并展示值", () => {
    render(
      <RunMetricsSection
        {...baseProps}
        metrics={{
          suspensionType: "nucleus",
          sequencingAmount: 100,
          capturedCells: 10836,
          medianGenes: 2634,
          cellAnnotation: null,
        }}
      />
    )
    expect(screen.getByRole("button", { name: "订正指标" })).toBeInTheDocument()
    expect(screen.getByText("10836")).toBeInTheDocument()
    expect(screen.getByText("细胞核")).toBeInTheDocument()
  })

  it("录入提交：POST run-metrics，body 含填写值，未选悬液类型落 null", async () => {
    const user = userEvent.setup()
    render(<RunMetricsSection {...baseProps} />)

    await user.click(screen.getByRole("button", { name: "录入指标" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("捕获细胞数"), { target: { value: "10836" } })
    fireEvent.change(screen.getByLabelText("基因中位数"), { target: { value: "2634" } })
    await user.click(screen.getByRole("button", { name: "保存" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("/api/experiment-tasks/e1/run-metrics")
    expect(init.method).toBe("POST")
    const body = JSON.parse(String(init.body))
    expect(body.capturedCells).toBe("10836")
    expect(body.medianGenes).toBe("2634")
    expect(body.suspensionType).toBeNull()
  })
})
