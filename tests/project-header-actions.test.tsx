import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ProjectHeaderActions } from "@/components/projects/project-header-actions"
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

describe("ProjectHeaderActions", () => {
  it("待交付项目：header 只露出主流程按钮和统一更多菜单", async () => {
    const user = userEvent.setup()
    render(<ProjectHeaderActions {...baseProps} status={ProjectStatus.waiting_delivery} />)

    expect(screen.getByRole("button", { name: "确认交付" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "编辑项目" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "项目 BP-G2601 更多动作" }))
    const menu = screen.getByRole("menu")
    expect(within(menu).getByRole("menuitem", { name: "编辑项目" })).toBeInTheDocument()
    expect(within(menu).getByRole("menuitem", { name: "标记异常" })).toBeInTheDocument()
    expect(within(menu).getByRole("menuitem", { name: "异常终止" })).toBeInTheDocument()
  })

  it("确认交付仍走项目状态动作 API", async () => {
    const user = userEvent.setup()
    render(<ProjectHeaderActions {...baseProps} status={ProjectStatus.waiting_delivery} />)

    await user.click(screen.getByRole("button", { name: "确认交付" }))
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "确认交付" }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    expect(url).toBe("/api/projects/p1/deliver")
  })
})
