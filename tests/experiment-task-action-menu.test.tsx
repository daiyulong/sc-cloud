import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
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
  workItemHref: "/lab?view=t1",
}

describe("ExperimentTaskActionMenu", () => {
  it("待排期：显示「设置排期」工作项入口，无溢出菜单", () => {
    render(<ExperimentTaskActionMenu {...baseProps} compact />)
    expect(screen.getByRole("link", { name: "设置排期" })).toHaveAttribute(
      "href",
      "/lab?view=t1"
    )
    expect(
      screen.queryByRole("button", { name: "任务 BP-G26001-E01 更多动作" })
    ).not.toBeInTheDocument()
  })

  it("已排期：开始实验也只进入工作项面板", () => {
    render(<ExperimentTaskActionMenu {...baseProps} status={ExperimentTaskStatus.scheduled} />)

    expect(screen.getByRole("link", { name: "开始实验" })).toHaveAttribute(
      "href",
      "/lab?view=t1"
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("进行中：提交反馈主入口进入工作项面板，不暴露行内溢出动作", () => {
    render(<ExperimentTaskActionMenu {...baseProps} status={ExperimentTaskStatus.in_progress} />)

    expect(screen.getByRole("link", { name: "提交实验反馈" })).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "任务 BP-G26001-E01 更多动作" })
    ).not.toBeInTheDocument()
  })

  it("viewer 角色：compact 渲染 null", () => {
    const { container } = render(
      <ExperimentTaskActionMenu {...baseProps} role={UserRole.viewer} compact />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
