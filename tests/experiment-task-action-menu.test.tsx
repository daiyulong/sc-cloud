import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ExperimentTaskActionMenu } from "@/components/experiment-tasks/experiment-task-action-menu"
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

const baseProps = {
  taskId: "t1",
  taskNo: "BP-G26001-E01",
  status: ExperimentTaskStatus.waiting_schedule,
  role: UserRole.lab_operator,
  operatorOptions: [{ id: "u1", name: "实验员一", department: "单细胞部" }],
}

describe("ExperimentTaskActionMenu", () => {
  it("待排期：显示「设置排期」主按钮，无溢出菜单", () => {
    render(<ExperimentTaskActionMenu {...baseProps} compact />)
    expect(screen.getByRole("button", { name: "设置排期" })).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "任务 BP-G26001-E01 更多动作" })
    ).not.toBeInTheDocument()
  })

  it("已排期：开始实验是 direct 动作，点击即调用 start API", async () => {
    const user = userEvent.setup()
    render(<ExperimentTaskActionMenu {...baseProps} status={ExperimentTaskStatus.scheduled} />)

    await user.click(screen.getByRole("button", { name: "开始实验" }))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("/api/experiment-tasks/t1/start")
    expect(init.method).toBe("POST")
  })

  it("进行中：提交反馈主按钮 + 溢出含完成实验/录入质控", async () => {
    const user = userEvent.setup()
    render(<ExperimentTaskActionMenu {...baseProps} status={ExperimentTaskStatus.in_progress} />)

    expect(screen.getByRole("button", { name: "提交实验反馈" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "任务 BP-G26001-E01 更多动作" }))
    expect(screen.getByRole("menuitem", { name: "完成实验（待反馈）" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "录入质控" })).toBeInTheDocument()
  })

  it("提交反馈 Dialog：结果反馈必填，填写后调用 feedback API", async () => {
    const user = userEvent.setup()
    render(<ExperimentTaskActionMenu {...baseProps} status={ExperimentTaskStatus.in_progress} />)

    await user.click(screen.getByRole("button", { name: "提交实验反馈" }))
    const dialog = screen.getByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "提交反馈" }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(within(dialog).getByText("结果反馈必填。")).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText("结果反馈"), {
      target: { value: "正常上机，捕获良好" },
    })
    await user.click(within(dialog).getByRole("button", { name: "提交反馈" }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("/api/experiment-tasks/t1/feedback")
    const body = JSON.parse(String(init.body))
    expect(body.resultStatus).toBe("normal_run")
    expect(body.resultFeedback).toBe("正常上机，捕获良好")
  })

  it("溢出「录入质控」：提交调用 qc API（结论默认通过）", async () => {
    const user = userEvent.setup()
    render(<ExperimentTaskActionMenu {...baseProps} status={ExperimentTaskStatus.in_progress} />)

    await user.click(screen.getByRole("button", { name: "任务 BP-G26001-E01 更多动作" }))
    await user.click(screen.getByRole("menuitem", { name: "录入质控" }))

    const dialog = screen.getByRole("dialog")
    fireEvent.change(within(dialog).getByLabelText("活率 %"), { target: { value: "90" } })
    await user.click(within(dialog).getByRole("button", { name: "录入质控" }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("/api/experiment-tasks/t1/qc")
    const body = JSON.parse(String(init.body))
    expect(body.qcResult).toBe("passed")
    expect(body.viability).toBe("90")
  })

  it("viewer 角色：compact 渲染 null", () => {
    const { container } = render(
      <ExperimentTaskActionMenu {...baseProps} role={UserRole.viewer} compact />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
