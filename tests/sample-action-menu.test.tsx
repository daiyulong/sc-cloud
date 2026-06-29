import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SampleActionMenu } from "@/components/samples/sample-action-menu"
import { SampleStatus, UserRole } from "@/lib/enums"

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
}

describe("SampleActionMenu", () => {
  it("waiting_arrival + 接收员：显示「登记接收」主按钮与溢出菜单", () => {
    render(<SampleActionMenu {...baseProps} compact />)
    expect(screen.getByRole("button", { name: "登记接收" })).toBeInTheDocument()
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

  it("登记接收 Dialog：补全信息 + 异常需选类型或说明，类型与说明组合写入 receive API", async () => {
    const user = userEvent.setup()
    render(<SampleActionMenu {...baseProps} />)

    await user.click(screen.getByRole("button", { name: "登记接收" }))
    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getByText("YP-001 · 补全样本信息并登记实际到样")).toBeInTheDocument()
    // 正常接收时无异常类型字段
    expect(within(dialog).queryByRole("button", { name: "温度异常" })).not.toBeInTheDocument()

    // 补全样本信息（建项目时只有编号+数量）
    fireEvent.change(within(dialog).getByLabelText("物种"), { target: { value: "人" } })
    fireEvent.change(within(dialog).getByLabelText("组织类型"), { target: { value: "肺" } })
    fireEvent.change(within(dialog).getByLabelText("实验类型"), { target: { value: "scRNA" } })
    fireEvent.change(within(dialog).getByLabelText("运输条件"), { target: { value: "干冰" } })

    // 切到异常接收 → 需选类型或填说明
    await user.click(within(dialog).getByRole("combobox"))
    await user.click(screen.getByRole("option", { name: "异常" }))
    await user.click(within(dialog).getByRole("button", { name: "登记接收" }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(within(dialog).getByText("异常接收需选择类型或填写说明。")).toBeInTheDocument()

    // 勾选异常类型 chip + 补充说明 → 组合写入 abnormalNote
    await user.click(within(dialog).getByRole("button", { name: "温度异常" }))
    fireEvent.change(within(dialog).getByPlaceholderText(/补充说明/), {
      target: { value: "运输超温" },
    })
    await user.click(within(dialog).getByRole("button", { name: "登记接收" }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("/api/samples/s1/receive")
    const body = JSON.parse(String(init.body))
    expect(body.species).toBe("人")
    expect(body.experimentType).toBe("scRNA")
    expect(body.receiveStatus).toBe("abnormal")
    expect(body.abnormalNote).toBe("温度异常 · 运输超温")
    expect(body.receivedAt).toBeTruthy()
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
