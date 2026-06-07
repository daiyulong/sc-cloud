import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRouter, useSearchParams } from "next/navigation"
import { ListToolbar } from "@/components/list/list-toolbar"

const replace = vi.fn()

function mockNavigation(search = "") {
  vi.mocked(useRouter).mockReturnValue({
    push: vi.fn(),
    replace,
    back: vi.fn(),
    refresh: vi.fn(),
  } as never)
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams(search) as never)
}

function lastHrefParams() {
  const href = replace.mock.calls.at(-1)?.[0] as string
  const [, queryString = ""] = href.split("?")
  return { href, params: new URLSearchParams(queryString) }
}

/** 绕过 React 受控 value 跟踪，派发带 isComposing 的原生 input 事件（模拟 IME 组合中） */
function fireComposingInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )!.set!
  setter.call(input, value)
  const event = new Event("input", { bubbles: true })
  Object.defineProperty(event, "isComposing", { value: true })
  fireEvent(input, event)
}

const statusFilter = {
  key: "status",
  label: "项目状态",
  allLabel: "全部状态",
  options: [
    { value: "draft", label: "草稿" },
    { value: "waiting_sample", label: "待到样" },
  ],
}

beforeEach(() => {
  replace.mockClear()
})

describe("ListToolbar 搜索", () => {
  // 仅搜索防抖需要 fake timers；Radix Select 在 fake timers 下与 userEvent 互卡，其余用真实计时
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("输入防抖 300ms 后 replace 一次：写入 q、重置 page、保留未操作参数", () => {
    mockNavigation("page=3&projectId=p1")
    render(<ListToolbar basePath="/samples" searchPlaceholder="搜索样本" />)

    const input = screen.getByRole("textbox")
    fireEvent.change(input, { target: { value: "BP" } })
    fireEvent.change(input, { target: { value: "BP-G" } })

    act(() => vi.advanceTimersByTime(299))
    expect(replace).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(replace).toHaveBeenCalledTimes(1)
    const { params } = lastHrefParams()
    expect(params.get("q")).toBe("BP-G")
    expect(params.get("page")).toBeNull()
    expect(params.get("projectId")).toBe("p1")
  })

  it("清空搜索词时从 URL 删除 q", () => {
    mockNavigation("q=abc")
    render(<ListToolbar basePath="/projects" searchPlaceholder="搜索项目" />)

    const input = screen.getByRole("textbox")
    expect(input).toHaveValue("abc")
    fireEvent.change(input, { target: { value: "" } })
    act(() => vi.advanceTimersByTime(300))

    expect(replace).toHaveBeenCalledTimes(1)
    expect(lastHrefParams().href).toBe("/projects")
  })

  it("IME 组合中不触发搜索，compositionEnd 后写入最终值", () => {
    mockNavigation("")
    render(<ListToolbar basePath="/projects" searchPlaceholder="搜索项目" />)

    const input = screen.getByRole<HTMLInputElement>("textbox")
    fireEvent.compositionStart(input)
    fireComposingInput(input, "ke")
    fireComposingInput(input, "kehu")
    act(() => vi.advanceTimersByTime(1000))
    expect(replace).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: "客户" } })
    fireEvent.compositionEnd(input)
    act(() => vi.advanceTimersByTime(300))
    expect(replace).toHaveBeenCalledTimes(1)
    expect(lastHrefParams().params.get("q")).toBe("客户")
  })

  it("URL 回流：未聚焦时输入框跟随 URL，聚焦时不被覆盖", () => {
    mockNavigation("")
    const view = render(<ListToolbar basePath="/projects" searchPlaceholder="搜索项目" />)
    const input = screen.getByRole("textbox")

    mockNavigation("q=abc")
    view.rerender(<ListToolbar basePath="/projects" searchPlaceholder="搜索项目" />)
    expect(input).toHaveValue("abc")

    act(() => input.focus())
    mockNavigation("q=xyz")
    view.rerender(<ListToolbar basePath="/projects" searchPlaceholder="搜索项目" />)
    expect(input).toHaveValue("abc")
  })
})

describe("ListToolbar 筛选 Select", () => {
  it("选择选项立即 replace 并重置 page", async () => {
    mockNavigation("page=2")
    const user = userEvent.setup()
    render(
      <ListToolbar basePath="/projects" searchPlaceholder="搜索项目" filters={[statusFilter]} />
    )

    await user.click(screen.getByRole("combobox", { name: "项目状态" }))
    await user.click(screen.getByRole("option", { name: "草稿" }))

    expect(replace).toHaveBeenCalledTimes(1)
    const { params } = lastHrefParams()
    expect(params.get("status")).toBe("draft")
    expect(params.get("page")).toBeNull()
  })

  it("选择哨兵「全部」时从 URL 删除该 key", async () => {
    mockNavigation("status=draft")
    const user = userEvent.setup()
    render(
      <ListToolbar
        basePath="/projects"
        searchPlaceholder="搜索项目"
        filters={[{ ...statusFilter, value: "draft" }]}
      />
    )

    await user.click(screen.getByRole("combobox", { name: "项目状态" }))
    await user.click(screen.getByRole("option", { name: "全部状态" }))

    expect(replace).toHaveBeenCalledTimes(1)
    expect(lastHrefParams().href).toBe("/projects")
  })
})

describe("ListToolbar 上下文 chip 与插槽", () => {
  it("渲染 chip，点 X 删除 clearKeys、保留其余筛选", () => {
    mockNavigation("projectId=p1&q=abc&status=received&page=2")
    render(
      <ListToolbar
        basePath="/samples"
        searchPlaceholder="搜索样本"
        context={{ label: "项目：BP-G2601", clearKeys: ["projectId"] }}
      />
    )

    expect(screen.getByText("项目：BP-G2601")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "清除上下文筛选" }))

    expect(replace).toHaveBeenCalledTimes(1)
    const { params } = lastHrefParams()
    expect(params.get("projectId")).toBeNull()
    expect(params.get("q")).toBe("abc")
    expect(params.get("status")).toBe("received")
    expect(params.get("page")).toBeNull()
  })

  it("children 渲染在右侧 action 插槽", () => {
    mockNavigation("")
    render(
      <ListToolbar basePath="/projects" searchPlaceholder="搜索项目">
        <button>新建项目</button>
      </ListToolbar>
    )
    expect(screen.getByRole("button", { name: "新建项目" })).toBeInTheDocument()
  })
})
