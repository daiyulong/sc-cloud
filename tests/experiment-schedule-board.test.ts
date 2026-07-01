import * as React from "react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

vi.mock("@/lib/utils", () => ({
  todayString: () => "2026-07-01",
  formatDate: (input: unknown) => {
    if (!input) return "-"
    const d = new Date(String(input))
    if (Number.isNaN(d.getTime())) return "-"
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  },
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  toDateOnly: (input: unknown) => {
    const d = new Date(String(input))
    if (Number.isNaN(d.getTime())) return null
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  },
  toDateString: (input: unknown) => {
    const d = new Date(String(input))
    if (Number.isNaN(d.getTime())) return null
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  },
}))

import { ExperimentScheduleBoard } from "@/components/experiment-tasks/experiment-schedule-board"
import {
  buildScheduleWindow,
  countScheduleTasksByDate,
  scheduleLoadLabel,
  scheduleLoadLevel,
  type ExperimentScheduleTask,
  type ExperimentScheduleAppointmentBatch,
} from "@/lib/experiment-tasks/lab-schedule"

const baseTask: ExperimentScheduleTask = {
  id: "task-1",
  taskNo: "BP-G260601008-E01",
  projectNo: "BP-G260601008",
  customerOrg: "上海市同济医院",
  experimentType: "组织解离",
  status: "scheduled",
  plannedDate: "2026-07-01",
  operatorName: "示例实验员",
  sampleCount: 1,
}

const baseBatch: ExperimentScheduleAppointmentBatch = {
  id: "batch-1",
  batchNo: "YP-001",
  projectId: "proj-1",
  projectNo: "BP-G260601008",
  customerOrg: "上海市同济医院",
  experimentType: "组织解离",
  receivedAt: "2026-06-30T09:00:00Z",
  sampleCount: 4,
}

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
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("mode=schedule") as never)
})

describe("实验排期负载面板辅助逻辑", () => {
  it("按计划日期统计日负载，未排期任务不计入", () => {
    const counts = countScheduleTasksByDate([
      baseTask,
      { ...baseTask, id: "task-2", taskNo: "BP-G260601008-E02" },
      { ...baseTask, id: "task-3", taskNo: "BP-G260601008-E03", plannedDate: "" },
      { ...baseTask, id: "task-4", taskNo: "BP-G260601008-E04", plannedDate: "2026-07-02" },
    ])

    expect(counts.get("2026-07-01")).toBe(2)
    expect(counts.get("2026-07-02")).toBe(1)
    expect(counts.has("")).toBe(false)
  })

  it("日负载分级与标签保持一致", () => {
    expect(scheduleLoadLevel(0)).toBe("idle")
    expect(scheduleLoadLabel(0)).toBe("空闲")
    expect(scheduleLoadLevel(3)).toBe("normal")
    expect(scheduleLoadLabel(3)).toBe("可预约")
    expect(scheduleLoadLevel(4)).toBe("busy")
    expect(scheduleLoadLabel(4)).toBe("较忙")
    expect(scheduleLoadLevel(6)).toBe("full")
    expect(scheduleLoadLabel(6)).toBe("高负载")
  })

  it("生成连续 14 天排期窗口", () => {
    expect(buildScheduleWindow("2026-07-01")).toEqual([
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
      "2026-07-04",
      "2026-07-05",
      "2026-07-06",
      "2026-07-07",
      "2026-07-08",
      "2026-07-09",
      "2026-07-10",
      "2026-07-11",
      "2026-07-12",
      "2026-07-13",
      "2026-07-14",
    ])
  })
})

describe("ExperimentScheduleBoard 组件层", () => {
  const h = React.createElement
  it("渲染 14 个日格 + 待预约批次空态", () => {
    render(
      h(ExperimentScheduleBoard, {
        tasks: [baseTask],
        appointmentBatches: [],
        canCreate: true,
      }),
    )
    const dayButtons = screen.getAllByRole("button", { name: /项已排/ })
    expect(dayButtons).toHaveLength(14)
    expect(screen.getByText("暂无待预约批次。")).toBeInTheDocument()
  })

  it("canCreate=false 时不渲染预约按钮", () => {
    render(
      h(ExperimentScheduleBoard, {
        tasks: [],
        appointmentBatches: [baseBatch],
        canCreate: false,
      }),
    )
    expect(screen.queryByText(/预约到 /)).not.toBeInTheDocument()
    expect(screen.getByText("YP-001")).toBeInTheDocument()
  })

  it("回归 2026-07-01: 点击日格 → URL 保留 mode=schedule(不能把用户踢出排期模式)，并清掉无关 query", async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("mode=schedule&status=open&view=abc&page=2&q=x") as never,
    )
    const user = userEvent.setup()
    render(
      h(ExperimentScheduleBoard, {
        tasks: [],
        appointmentBatches: [],
        canCreate: true,
      }),
    )
    const dayButtons = screen.getAllByRole("button", { name: /项已排/ })
    await user.click(dayButtons[13])

    expect(replace).toHaveBeenCalledTimes(1)
    const [href] = replace.mock.calls[0]
    const url = new URL(href as string, "http://x")
    expect(url.searchParams.get("plannedDate")).toBe("2026-07-14")
    expect(url.searchParams.get("mode")).toBe("schedule")
    expect(url.searchParams.has("status")).toBe(false)
    expect(url.searchParams.has("view")).toBe(false)
    expect(url.searchParams.has("page")).toBe(false)
    expect(url.searchParams.has("q")).toBe(false)
  })

  it("回归 2026-07-01: 点击预约按钮 → URL 保留 mode=schedule，同时写入 plannedDate / new=1 / sampleBatchId，且清掉 view", async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("mode=schedule&view=oldtask") as never,
    )
    const user = userEvent.setup()
    render(
      h(ExperimentScheduleBoard, {
        tasks: [],
        appointmentBatches: [baseBatch],
        canCreate: true,
      }),
    )
    const reserveLink = screen.getByRole("link", { name: /预约到 / })
    await user.click(reserveLink)
    const href = reserveLink.getAttribute("href") ?? ""
    const url = new URL(href, "http://x")
    expect(url.searchParams.get("plannedDate")).toBe("2026-07-01")
    expect(url.searchParams.get("new")).toBe("1")
    expect(url.searchParams.get("sampleBatchId")).toBe("batch-1")
    expect(url.searchParams.has("view")).toBe(false)
    expect(url.searchParams.get("mode")).toBe("schedule")
    expect(url.searchParams.has("q")).toBe(false)
  })

  it("日负载正确显示每项已排数量", () => {
    render(
      h(ExperimentScheduleBoard, {
        tasks: [baseTask, { ...baseTask, id: "task-2", plannedDate: "2026-07-01" }],
        appointmentBatches: [],
        canCreate: false,
      }),
    )
    const dayButtons = screen.getAllByRole("button", { name: /项已排/ })
    expect(within(dayButtons[0]).getByText("2")).toBeInTheDocument()
  })
})

