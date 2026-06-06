import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRouter } from "next/navigation"
import { DetailSheet } from "@/components/detail/detail-sheet"

const back = vi.fn()

beforeEach(() => {
  back.mockClear()
  vi.mocked(useRouter).mockReturnValue({
    push: vi.fn(),
    replace: vi.fn(),
    back,
    refresh: vi.fn(),
  } as never)
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

  it("点击关闭按钮 → router.back()", async () => {
    const user = userEvent.setup()
    render(
      <DetailSheet title="样本 YP-001">
        <p>详情内容</p>
      </DetailSheet>
    )
    await user.click(screen.getByRole("button", { name: "Close" }))
    expect(back).toHaveBeenCalledTimes(1)
  })

  it("ESC 关闭 → router.back()", async () => {
    const user = userEvent.setup()
    render(
      <DetailSheet title="样本 YP-001">
        <p>详情内容</p>
      </DetailSheet>
    )
    await user.keyboard("{Escape}")
    expect(back).toHaveBeenCalledTimes(1)
  })
})
