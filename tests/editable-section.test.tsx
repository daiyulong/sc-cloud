import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRouter } from "next/navigation"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EditableSection } from "@/components/detail/editable-section"

const refresh = vi.fn()
const fetchMock = vi.fn()

beforeEach(() => {
  refresh.mockClear()
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  vi.mocked(useRouter).mockReturnValue({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh,
  } as never)
})

describe("EditableSection", () => {
  it("读态展示字段，点击编辑后整段切换为表单", async () => {
    const user = userEvent.setup()
    render(
      <EditableSection
        title="批次信息"
        endpoint="/api/samples/s1"
        fields={[
          { name: "species", label: "样本物种", value: "人" },
          { name: "sampleCount", label: "样本数量", value: 2, type: "number" },
          { name: "createdAt", label: "创建时间", displayValue: "2026/06/30", editable: false },
        ]}
      />
    )

    expect(screen.getByText("样本物种")).toBeInTheDocument()
    expect(screen.getByText("人")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "编辑" }))

    expect(screen.getByLabelText("样本物种")).toHaveValue("人")
    expect(screen.getByLabelText("样本数量")).toHaveValue(2)
    expect(screen.getByText("2026/06/30")).toBeInTheDocument()
  })

  it("保存时只提交发生变化的字段", async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )

    render(
      <EditableSection
        title="批次信息"
        endpoint="/api/samples/s1"
        fields={[
          { name: "species", label: "样本物种", value: "人" },
          { name: "sampleCount", label: "样本数量", value: 2, type: "number" },
        ]}
      />
    )

    await user.click(screen.getByRole("button", { name: "编辑" }))
    await user.clear(screen.getByLabelText("样本物种"))
    await user.type(screen.getByLabelText("样本物种"), "小鼠")
    await user.click(screen.getByRole("button", { name: "保存" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith("/api/samples/s1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ species: "小鼠" }),
    })
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
