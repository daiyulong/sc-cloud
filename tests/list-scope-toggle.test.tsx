import * as React from "react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

import { ListScopeToggle } from "@/components/list/list-scope-toggle"

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

describe("ListScopeToggle", () => {
  it("默认 mine:点击「团队」写入 scope=team", async () => {
    const user = userEvent.setup()
    render(<ListScopeToggle basePath="/lab" />)
    await user.click(screen.getByRole("button", { name: "团队" }))
    const [href] = replace.mock.calls.at(-1) ?? []
    expect(href).toBe("/lab?scope=team")
  })

  it("默认 mine:点击「我的」(默认)移除 scope 参数、保留其余", async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("scope=team&q=pbmc") as never,
    )
    const user = userEvent.setup()
    render(<ListScopeToggle basePath="/lab" />)
    await user.click(screen.getByRole("button", { name: "我的" }))
    const [href] = replace.mock.calls.at(-1) ?? []
    const url = new URL(href as string, "http://x")
    expect(url.searchParams.has("scope")).toBe(false)
    expect(url.searchParams.get("q")).toBe("pbmc")
  })

  it("URL 中已有 mine:当前 mine 高亮(aria-pressed=true)", () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("scope=mine") as never,
    )
    render(<ListScopeToggle basePath="/lab" />)
    expect(screen.getByRole("button", { name: "我的" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(screen.getByRole("button", { name: "团队" })).toHaveAttribute(
      "aria-pressed",
      "false",
    )
  })

  it("默认改成 team:点击「团队」(默认)→ 不写 scope,只为「我的」写", async () => {
    const user = userEvent.setup()
    render(<ListScopeToggle basePath="/lab" defaultValue="team" />)
    await user.click(screen.getByRole("button", { name: "团队" }))
    expect(replace).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "我的" }))
    const [href] = replace.mock.calls.at(-1) ?? []
    expect(href).toBe("/lab?scope=mine")
  })

  it("点击当前选中项不重复触发导航(幂等)", async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("scope=team") as never,
    )
    const user = userEvent.setup()
    render(<ListScopeToggle basePath="/lab" />)
    await user.click(screen.getByRole("button", { name: "团队" }))
    expect(replace).not.toHaveBeenCalled()
  })
})
