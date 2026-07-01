import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SampleActionMenu } from "@/components/samples/sample-action-menu"
import { ProjectStatus, SampleStatus, UserRole } from "@/lib/enums"

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
  sampleId: "s1",
  sampleNo: "YP-001",
  status: SampleStatus.waiting_arrival,
  role: UserRole.sample_receiver,
  workItemHref: "/intake?view=s1",
}

describe("SampleActionMenu", () => {
  it("waiting_arrival + 接收员：显示「登记接收」工作项入口与溢出菜单", () => {
    render(<SampleActionMenu {...baseProps} compact />)
    expect(screen.getByRole("link", { name: "登记接收" })).toHaveAttribute(
      "href",
      "/intake?view=s1"
    )
    expect(
      screen.getByRole("button", { name: "样本 YP-001 更多动作" })
    ).toBeInTheDocument()
  })

  it("received：无主按钮，仅溢出菜单", () => {
    render(<SampleActionMenu {...baseProps} status={SampleStatus.received} />)
    expect(screen.queryByRole("button", { name: "登记接收" })).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "样本 YP-001 更多动作" })
    ).toBeInTheDocument()
  })

  it("viewer 角色：渲染 null（compact）/ 提示文案（showEmptyHint）", () => {
    const { container } = render(
      <SampleActionMenu {...baseProps} role={UserRole.viewer} compact />
    )
    expect(container).toBeEmptyDOMElement()

    render(<SampleActionMenu {...baseProps} role={UserRole.viewer} showEmptyHint />)
    expect(screen.getByText("当前状态暂无可执行样本动作。")).toBeInTheDocument()
  })

  it("登记接收主按钮：进入工作项面板，不在动作菜单内弹二级表单", () => {
    render(<SampleActionMenu {...baseProps} />)

    const link = screen.getByRole("link", { name: "登记接收" })
    expect(link).toHaveAttribute("href", "/intake?view=s1")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("缺少 workItemHref 时：不渲染无法落地的登记接收按钮", () => {
    const props = { ...baseProps, workItemHref: undefined }
    render(<SampleActionMenu {...props} />)

    expect(screen.queryByRole("button", { name: "登记接收" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "登记接收" })).not.toBeInTheDocument()
  })

  it("项目草稿：不渲染登记接收入口", () => {
    render(<SampleActionMenu {...baseProps} projectStatus={ProjectStatus.draft} />)

    expect(screen.queryByRole("link", { name: "登记接收" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "样本 YP-001 更多动作" })).toBeInTheDocument()
  })

  it("溢出菜单「登记样本异常」：原因必填，提交调用 mark-abnormal API", async () => {
    const user = userEvent.setup()
    render(<SampleActionMenu {...baseProps} />)

    await user.click(screen.getByRole("button", { name: "样本 YP-001 更多动作" }))
    await user.click(screen.getByRole("menuitem", { name: "登记样本异常" }))

    const dialog = screen.getByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "登记样本异常" }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(within(dialog).getByText("请填写异常原因。")).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText(/异常原因/), {
      target: { value: "样本污染" },
    })
    await user.click(within(dialog).getByRole("button", { name: "登记样本异常" }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("/api/samples/s1/mark-abnormal")
    expect(JSON.parse(String(init.body))).toEqual({ reason: "样本污染" })
  })
})
