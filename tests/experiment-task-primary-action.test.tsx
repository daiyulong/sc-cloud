import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ExperimentTaskPrimaryAction } from "@/components/experiment-tasks/experiment-task-primary-action"
import { ExperimentTaskStatus } from "@/lib/enums"

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

const baseProps = {
  taskId: "t1",
  taskNo: "BP-G26001-E01",
  operatorOptions: [{ id: "u1", name: "实验员一", department: "单细胞部" }],
  bioinfoEnabled: true,
  analystOptions: [{ id: "b1", name: "生信一", department: "生信部" }],
}

describe("ExperimentTaskPrimaryAction", () => {
  it("待排期：面板内提交排期表单", async () => {
    const user = userEvent.setup()
    render(
      <ExperimentTaskPrimaryAction
        {...baseProps}
        status={ExperimentTaskStatus.waiting_schedule}
      />
    )

    fireEvent.change(screen.getByLabelText("计划实验日期"), {
      target: { value: "2026-07-01" },
    })
    fireEvent.change(screen.getByLabelText("上机方式"), {
      target: { value: "GEM-X" },
    })
    await user.click(screen.getByRole("button", { name: "设置排期" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("/api/experiment-tasks/t1/schedule")
    const body = JSON.parse(String(init.body))
    expect(body).toMatchObject({
      plannedDate: "2026-07-01",
      operatorId: null,
      runMethod: "GEM-X",
      department: null,
    })
  })

  it("已排期：面板内开始实验", async () => {
    const user = userEvent.setup()
    render(
      <ExperimentTaskPrimaryAction
        {...baseProps}
        status={ExperimentTaskStatus.scheduled}
        actualDate="2026-07-02"
      />
    )

    await user.click(screen.getByRole("button", { name: "开始实验" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("/api/experiment-tasks/t1/start")
    expect(JSON.parse(String(init.body))).toEqual({ actualDate: "2026-07-02" })
  })

  it("进行中：反馈必填，提交后调用 feedback API", async () => {
    const user = userEvent.setup()
    render(
      <ExperimentTaskPrimaryAction
        {...baseProps}
        status={ExperimentTaskStatus.in_progress}
        actualDate="2026-07-03"
      />
    )

    await user.click(screen.getByRole("button", { name: "提交反馈" }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText("结果反馈必填。")).toHaveClass("text-destructive")

    fireEvent.change(screen.getByLabelText("结果反馈"), {
      target: { value: "正常上机，捕获良好" },
    })
    await user.click(screen.getByRole("button", { name: "提交反馈" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("/api/experiment-tasks/t1/feedback")
    const body = JSON.parse(String(init.body))
    expect(body).toMatchObject({
      resultStatus: "normal_run",
      resultFeedback: "正常上机，捕获良好",
      actualDate: "2026-07-03",
      bioinfoAnalystId: null,
    })
  })

  it("进行中：可只标记完成，稍后反馈", async () => {
    const user = userEvent.setup()
    render(
      <ExperimentTaskPrimaryAction
        {...baseProps}
        status={ExperimentTaskStatus.in_progress}
        actualDate="2026-07-04"
      />
    )

    await user.click(screen.getByRole("button", { name: "仅标记完成" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("/api/experiment-tasks/t1/finish")
    expect(JSON.parse(String(init.body))).toEqual({ actualDate: "2026-07-04" })
  })
})
