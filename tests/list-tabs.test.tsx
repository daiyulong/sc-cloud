import * as React from "react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

import { ListTabs } from "@/components/list/list-tabs"

const replace = vi.fn()

beforeEach(() => {
  replace.mockClear()
  vi.mocked(useRouter).mockReturnValue({
    push: vi.fn(),
    replace,
    back: vi.fn(),
    refresh: vi.fn(),
  } as never)
  vi.mocked(usePathname).mockReturnValue("/lab")
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("") as never)
})

describe("ListTabs", () => {
  it("默认值不写 tab 参数;切换时把 tab 写到 URL 并清 page", async () => {
    const user = userEvent.setup()
    render(
      <ListTabs
        basePath="/lab"
        items={[
          { value: "todo", label: "待办" },
          { value: "doing", label: "进行中" },
          { value: "done", label: "已完成" },
        ]}
      />,
    )
    expect(screen.getByRole("tab", { name: /待办/ })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /进行中/ })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /已完成/ })).toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: /进行中/ }))
    const [href] = replace.mock.calls.at(-1) ?? []
    expect(href).toBe("/lab?tab=doing")
  })

  it("值由调用方传入(value prop)控制高亮;URL query 是调用方责任", () => {
    render(
      <ListTabs
        basePath="/lab"
        value="done"
        items={[
          { value: "todo", label: "待办" },
          { value: "doing", label: "进行中" },
          { value: "done", label: "已完成" },
        ]}
      />,
    )
    const doneTab = screen.getByRole("tab", { name: /已完成/ })
    expect(doneTab.getAttribute("data-state")).toBe("active")
  })

  it("切换时保留其余 URL 参数(过滤/分页等)", async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("status=in_progress&page=3&q=pbmc") as never,
    )
    const user = userEvent.setup()
    render(
      <ListTabs
        basePath="/lab"
        items={[
          { value: "todo", label: "待办" },
          { value: "doing", label: "进行中" },
        ]}
      />,
    )
    await user.click(screen.getByRole("tab", { name: /进行中/ }))
    const [href] = replace.mock.calls.at(-1) ?? []
    const url = new URL(href as string, "http://x")
    expect(url.searchParams.get("tab")).toBe("doing")
    expect(url.searchParams.get("status")).toBe("in_progress")
    expect(url.searchParams.get("q")).toBe("pbmc")
    expect(url.searchParams.has("page")).toBe(false)
  })

  it("count 数字以次级文本形式出现在 label 后", () => {
    render(
      <ListTabs
        basePath="/lab"
        items={[
          { value: "todo", label: "待办", count: 5 },
          { value: "doing", label: "进行中" },
        ]}
      />,
    )
    expect(screen.getByText("5")).toBeInTheDocument()
  })

  it("切换到默认项 = 把 searchKey 移除,保留其余 query(scope 等)", async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("scope=mine") as never,
    )
    const user = userEvent.setup()
    render(
      <ListTabs
        basePath="/lab"
        value="doing"
        items={[
          { value: "todo", label: "待办" },
          { value: "doing", label: "进行中" },
        ]}
      />,
    )
    await user.click(screen.getByRole("tab", { name: /待办/ }))
    const [href] = replace.mock.calls.at(-1) ?? []
    const url = new URL(href as string, "http://x")
    expect(url.searchParams.has("tab")).toBe(false)
    expect(url.searchParams.get("scope")).toBe("mine")
  })
})
