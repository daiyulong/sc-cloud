import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { SampleReceiveForm } from "@/components/samples/sample-receive-form"

const fetchMock = vi.fn(
  async () => new Response(JSON.stringify({ ok: true }), { status: 200 })
)
const push = vi.fn()
const refresh = vi.fn()

beforeEach(() => {
  fetchMock.mockClear()
  push.mockClear()
  refresh.mockClear()
  vi.stubGlobal("fetch", fetchMock)
  vi.mocked(useRouter).mockReturnValue({
    push,
    replace: vi.fn(),
    back: vi.fn(),
    refresh,
  } as never)
  vi.mocked(usePathname).mockReturnValue("/intake")
  vi.mocked(useSearchParams).mockReturnValue(
    new URLSearchParams("status=waiting_arrival&view=s1") as never
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("SampleReceiveForm", () => {
  it("补全信息并提交登记接收 API", async () => {
    const user = userEvent.setup()
    render(
      <SampleReceiveForm
        endpoint="/api/samples/s1/receive"
        sampleNo="YP-001"
        batchNo="YP-001"
      />
    )

    fireEvent.change(screen.getByLabelText("物种"), { target: { value: "人" } })
    fireEvent.change(screen.getByLabelText("组织类型"), { target: { value: "肺" } })
    fireEvent.change(screen.getByLabelText("实验类型"), { target: { value: "scRNA" } })
    fireEvent.change(screen.getByLabelText("运输条件"), { target: { value: "干冰" } })
    fireEvent.change(screen.getByLabelText("样本数量"), { target: { value: "2" } })

    await user.click(screen.getByRole("button", { name: "确认接收" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("/api/samples/s1/receive")
    const body = JSON.parse(String(init.body))
    expect(body).toMatchObject({
      batchNo: "YP-001",
      species: "人",
      tissueType: "肺",
      experimentType: "scRNA",
      transportCondition: "干冰",
      sampleCount: "2",
      receiveStatus: "normal",
      abnormalNote: null,
    })
    expect(body.receivedAt).toBeTruthy()
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it("异常接收需选择类型或填写说明，并组合写入 abnormalNote", async () => {
    const user = userEvent.setup()
    render(
      <SampleReceiveForm
        endpoint="/api/samples/s1/receive"
        sampleNo="YP-001"
        species="小鼠"
        tissueType="肝脏组织"
        experimentType="组织解离"
        transportCondition="冰袋"
        sampleCount={2}
      />
    )

    await user.click(screen.getByRole("combobox"))
    await user.click(screen.getByRole("option", { name: "异常" }))
    await user.click(screen.getByRole("button", { name: "确认接收" }))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText("异常接收需选择类型或填写说明。")).toHaveClass(
      "text-destructive"
    )

    await user.click(screen.getByRole("button", { name: "温度异常" }))
    fireEvent.change(screen.getByPlaceholderText(/补充说明/), {
      target: { value: "运输超温" },
    })
    await user.click(screen.getByRole("button", { name: "确认接收" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(String(init.body))
    expect(body.receiveStatus).toBe("abnormal")
    expect(body.abnormalNote).toBe("温度异常 · 运输超温")
  })

  it("取消时只移除 view 参数并保留筛选", async () => {
    const user = userEvent.setup()
    render(
      <SampleReceiveForm
        endpoint="/api/samples/s1/receive"
        sampleNo="YP-001"
        sampleCount={1}
      />
    )

    await user.click(screen.getByRole("button", { name: "取消" }))

    expect(push).toHaveBeenCalledWith("/intake?status=waiting_arrival", {
      scroll: false,
    })
  })
})
