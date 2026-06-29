import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { DetailSheet } from "@/components/detail/detail-sheet"

const push = vi.fn()

beforeEach(() => {
  push.mockClear()
  vi.mocked(useRouter).mockReturnValue({
    push,
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  } as never)
  // 当前在 /lab，已带筛选 status=open 与抽屉参数 view=abc
  vi.mocked(usePathname).mockReturnValue("/lab")
  vi.mocked(useSearchParams).mockReturnValue(
    new URLSearchParams("status=open&view=abc") as never
  )
})

describe("DetailSheet", () => {
  it("初始打开并渲染内容", () => {
    render(
      <DetailSheet title="样本 YP-001">
        <p>详情内容</p>
      </DetailSheet>
    )
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("详情内容")).toBeInTheDocument()
  })

  it("点击关闭按钮 → 仅移除 view 参数、保留筛选回列表", async () => {
    const user = userEvent.setup()
    render(
      <DetailSheet title="样本 YP-001">
        <p>详情内容</p>
      </DetailSheet>
    )
    await user.click(screen.getByRole("button", { name: "Close" }))
    expect(push).toHaveBeenCalledWith("/lab?status=open", { scroll: false })
  })

  it("ESC 关闭 → 仅移除 view 参数、保留筛选回列表", async () => {
    const user = userEvent.setup()
    render(
      <DetailSheet title="样本 YP-001">
        <p>详情内容</p>
      </DetailSheet>
    )
    await user.keyboard("{Escape}")
    expect(push).toHaveBeenCalledWith("/lab?status=open", { scroll: false })
  })
})
