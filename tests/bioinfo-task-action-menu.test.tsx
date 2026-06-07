import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { BioinfoTaskActionMenu } from "@/components/bioinfo-tasks/bioinfo-task-action-menu"
import { BioinfoTaskStatus, UserRole } from "@/lib/enums"

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
  taskId: "b1",
  taskNo: "BP-G26001-B01",
  status: BioinfoTaskStatus.pending,
  role: UserRole.bioinfo_analyst,
  analysisType: "标准分析",
}

describe("BioinfoTaskActionMenu", () => {
  it("待开始：开始分析是 direct 动作，点击即调用 start API", async () => {
    const user = userEvent.setup()
    render(<BioinfoTaskActionMenu {...baseProps} />)

    await user.click(screen.getByRole("button", { name: "开始分析" }))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("/api/bioinfo-tasks/b1/start")
    expect(init.method).toBe("POST")
  })

  it("分析中：提交报告主按钮 + 溢出含提交审核", async () => {
    const user = userEvent.setup()
    render(<BioinfoTaskActionMenu {...baseProps} status={BioinfoTaskStatus.in_progress} />)

    expect(screen.getByRole("button", { name: "提交报告" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "任务 BP-G26001-B01 更多动作" }))
    expect(screen.getByRole("menuitem", { name: "提交审核" })).toBeInTheDocument()
  })

  it("提交审核（溢出）是 direct 动作，调用 review API", async () => {
    const user = userEvent.setup()
    render(<BioinfoTaskActionMenu {...baseProps} status={BioinfoTaskStatus.in_progress} />)

    await user.click(screen.getByRole("button", { name: "任务 BP-G26001-B01 更多动作" }))
    await user.click(screen.getByRole("menuitem", { name: "提交审核" }))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("/api/bioinfo-tasks/b1/review")
  })

  it("提交报告 Dialog：分析类型预填，提交调用 submit API", async () => {
    const user = userEvent.setup()
    render(<BioinfoTaskActionMenu {...baseProps} status={BioinfoTaskStatus.in_progress} />)

    await user.click(screen.getByRole("button", { name: "提交报告" }))
    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getByLabelText("分析类型")).toHaveValue("标准分析")

    fireEvent.change(within(dialog).getByLabelText("交付物说明"), {
      target: { value: "报告+矩阵文件" },
    })
    await user.click(within(dialog).getByRole("button", { name: "提交报告" }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("/api/bioinfo-tasks/b1/submit")
    const body = JSON.parse(String(init.body))
    expect(body.analysisType).toBe("标准分析")
    expect(body.deliverableNote).toBe("报告+矩阵文件")
  })

  it("viewer 角色：compact 渲染 null", () => {
    const { container } = render(
      <BioinfoTaskActionMenu {...baseProps} role={UserRole.viewer} compact />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
