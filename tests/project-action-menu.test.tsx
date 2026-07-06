import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ProjectActionMenu } from "@/components/projects/project-action-menu"
import { ProjectStatus, UserRole } from "@/lib/enums"

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
  projectId: "p1",
  projectNo: "BP-G2601",
  role: UserRole.project_manager,
}

describe("ProjectActionMenu", () => {
  it("draft：「确认项目」直接执行（无需弹窗），项目编号在样本接收后补填", async () => {
    const user = userEvent.setup()
    render(<ProjectActionMenu {...baseProps} status={ProjectStatus.draft} />)

    await user.click(screen.getByRole("button", { name: "确认项目" }))

    // confirm 改为 direct，点击即执行，无 dialog
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("/api/projects/p1/confirm")
    expect(JSON.parse(String(init.body))).toEqual({})
  })

  it("waiting_delivery：「确认交付」先弹轻确认，确认后执行（直接关项目）", async () => {
    const user = userEvent.setup()
    render(<ProjectActionMenu {...baseProps} status={ProjectStatus.waiting_delivery} />)

    await user.click(screen.getByRole("button", { name: "确认交付" }))
    expect(fetchMock).not.toHaveBeenCalled()
    const dialog = screen.getByRole("dialog")
    expect(
      within(dialog).getByText(
        "确认交付后项目进入已完成终态，并级联交付项目下待交付的生信任务。"
      )
    ).toBeInTheDocument()

    await user.click(within(dialog).getByRole("button", { name: "确认交付" }))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    expect(url).toBe("/api/projects/p1/deliver")
  })

  it("溢出菜单「标记异常」：原因必填，提交带 reason", async () => {
    const user = userEvent.setup()
    render(<ProjectActionMenu {...baseProps} status={ProjectStatus.draft} />)

    await user.click(screen.getByRole("button", { name: "项目 BP-G2601 更多动作" }))
    await user.click(screen.getByRole("menuitem", { name: "标记异常" }))

    const dialog = screen.getByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "标记异常" }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(within(dialog).getByText("请填写异常原因。")).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText(/异常原因/), {
      target: { value: "客户要求暂停" },
    })
    await user.click(within(dialog).getByRole("button", { name: "标记异常" }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("/api/projects/p1/mark-abnormal")
    expect(JSON.parse(String(init.body))).toEqual({ reason: "客户要求暂停" })
  })

  it("销售角色：渲染 null", () => {
    const { container } = render(
      <ProjectActionMenu
        {...baseProps}
        role={UserRole.sales_owner}
        status={ProjectStatus.draft}
        compact
      />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
