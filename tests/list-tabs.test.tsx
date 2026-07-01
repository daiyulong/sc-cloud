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

  it("回归 2026-07-01: defaultValue 与 items[0] 不同时,点击非默认首项不会被误判为默认值清空", async () => {
    // 复现 /lab 真实场景:items[0]="todo",但页面实际默认值是 "doing"(defaultValue="doing")。
    // 组件若仍按 items[0] 判断"是否默认"，点击"待办"(todo, items[0])会被误当成默认值而清空
    // tab 参数，导致落地页被 parseTab(undefined) ?? "doing" 解析回"doing"，而不是用户点的"待办"。
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("tab=done") as never)
    const user = userEvent.setup()
    render(
      <ListTabs
        basePath="/lab"
        value="done"
        defaultValue="doing"
        items={[
          { value: "todo", label: "待办" },
          { value: "doing", label: "进行中" },
          { value: "done", label: "已完成" },
        ]}
      />,
    )
    await user.click(screen.getByRole("tab", { name: /待办/ }))
    const [href] = replace.mock.calls.at(-1) ?? []
    const url = new URL(href as string, "http://x")
    // 点"待办"必须显式写 tab=todo，不能因为它是 items[0] 就被当成默认值清掉参数
    expect(url.searchParams.get("tab")).toBe("todo")
  })

  it("回归 2026-07-01: 点击真正的 defaultValue 项才清空 searchKey", async () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("tab=done") as never)
    const user = userEvent.setup()
    render(
      <ListTabs
        basePath="/lab"
        value="done"
        defaultValue="doing"
        items={[
          { value: "todo", label: "待办" },
          { value: "doing", label: "进行中" },
          { value: "done", label: "已完成" },
        ]}
      />,
    )
    await user.click(screen.getByRole("tab", { name: /进行中/ }))
    const [href] = replace.mock.calls.at(-1) ?? []
    const url = new URL(href as string, "http://x")
    expect(url.searchParams.has("tab")).toBe(false)
  })

  it("显式 href 的项(如跨 query key 的入口)跳过 isDefault 判断，始终用给定 href", async () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("tab=doing") as never)
    const user = userEvent.setup()
    render(
      <ListTabs
        basePath="/lab"
        value="doing"
        defaultValue="doing"
        items={[
          { value: "todo", label: "待办" },
          { value: "doing", label: "进行中" },
          { value: "other", label: "其他", href: "/lab?mode=other&plannedDate=2026-07-03" },
        ]}
      />,
    )
    await user.click(screen.getByRole("tab", { name: /其他/ }))
    const [href] = replace.mock.calls.at(-1) ?? []
    expect(href).toBe("/lab?mode=other&plannedDate=2026-07-03")
  })

  it("回归 2026-07-01: value 显式传 null 时不高亮任何一项(调用方处于正交的另一模式)", () => {
    // 复现场景:/lab 进入"排期看板"(与状态 Tab 正交的独立工具)时，
    // 待办/进行中/已完成都不该显示为选中态。
    render(
      <ListTabs
        basePath="/lab"
        value={null}
        defaultValue="doing"
        items={[
          { value: "todo", label: "待办" },
          { value: "doing", label: "进行中" },
          { value: "done", label: "已完成" },
        ]}
      />,
    )
    for (const name of [/待办/, /进行中/, /已完成/]) {
      expect(screen.getByRole("tab", { name }).getAttribute("data-state")).toBe("inactive")
    }
  })

  it("value=null 时 Tab 仍可点击导航(不是禁用状态)", async () => {
    const user = userEvent.setup()
    render(
      <ListTabs
        basePath="/lab"
        value={null}
        defaultValue="doing"
        items={[
          { value: "todo", label: "待办" },
          { value: "doing", label: "进行中" },
        ]}
      />,
    )
    await user.click(screen.getByRole("tab", { name: /待办/ }))
    const [href] = replace.mock.calls.at(-1) ?? []
    expect(href).toBe("/lab?tab=todo")
  })

  it("回归 2026-07-01: variant='default' 用于上级模式切换(与下级状态 Tab 的下划线区分层级)", () => {
    render(
      <ListTabs
        basePath="/lab"
        searchKey="mode"
        variant="default"
        defaultValue="tasks"
        items={[
          { value: "tasks", label: "任务" },
          { value: "schedule", label: "排期", href: "/lab?mode=schedule" },
        ]}
      />,
    )
    // TabsList 的 data-variant 属性反映所选样式
    const tablist = screen.getByRole("tablist")
    expect(tablist.getAttribute("data-variant")).toBe("default")
  })

  it("默认 variant 仍是 'line'(不传时不影响现有状态 Tab 用法)", () => {
    render(
      <ListTabs
        basePath="/lab"
        items={[
          { value: "todo", label: "待办" },
          { value: "doing", label: "进行中" },
        ]}
      />,
    )
    expect(screen.getByRole("tablist").getAttribute("data-variant")).toBe("line")
  })
})
