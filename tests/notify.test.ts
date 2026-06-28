import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { isNotifyEnabled, sendMail } from "@/lib/notify/mailer"
import { buildReminderBody, type BioinfoTaskForNotify } from "@/lib/notify/task-reminder"

const sendMailMock = vi.fn()
vi.mock("nodemailer", () => ({
  createTransport: () => ({ sendMail: sendMailMock }),
  default: { createTransport: () => ({ sendMail: sendMailMock }) },
}))

const ENV_KEYS = ["NOTIFY_ENABLED", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "MAIL_FROM", "APP_BASE_URL"]

describe("mailer 通道选择", () => {
  const saved: Record<string, string | undefined> = {}
  beforeEach(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k]
    for (const k of ENV_KEYS) delete process.env[k]
    sendMailMock.mockReset()
  })
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  it("NOTIFY_ENABLED 未开 → disabled、不发", async () => {
    const r = await sendMail({ to: "a@b.com", subject: "s", text: "t" })
    expect(r.transport).toBe("disabled")
    expect(r.delivered).toBe(false)
    expect(sendMailMock).not.toHaveBeenCalled()
    expect(isNotifyEnabled()).toBe(false)
  })

  it("开启但无 SMTP_HOST → log 回退、不真发", async () => {
    process.env.NOTIFY_ENABLED = "1"
    const r = await sendMail({ to: "a@b.com", subject: "s", text: "t" })
    expect(r.transport).toBe("log")
    expect(r.delivered).toBe(false)
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it("开启且配 SMTP_HOST → smtp、真实投递", async () => {
    process.env.NOTIFY_ENABLED = "1"
    process.env.SMTP_HOST = "smtp.example.com"
    sendMailMock.mockResolvedValueOnce({ messageId: "x" })
    const r = await sendMail({ to: "a@b.com", subject: "s", text: "t" })
    expect(r.transport).toBe("smtp")
    expect(r.delivered).toBe(true)
    expect(sendMailMock).toHaveBeenCalledOnce()
  })

  it("SMTP 发送抛错 → delivered=false、带 error、不抛出", async () => {
    process.env.NOTIFY_ENABLED = "1"
    process.env.SMTP_HOST = "smtp.example.com"
    sendMailMock.mockRejectedValueOnce(new Error("connect ECONNREFUSED"))
    const r = await sendMail({ to: "a@b.com", subject: "s", text: "t" })
    expect(r.transport).toBe("smtp")
    expect(r.delivered).toBe(false)
    expect(r.error).toContain("ECONNREFUSED")
  })
})

describe("buildReminderBody", () => {
  const task: BioinfoTaskForNotify = {
    id: "task-1",
    taskNo: "BP-G260505743-B01",
    analysisType: "标准分析",
    projectId: "proj-1",
    analyst: { name: "张三", email: "zhang@lab.com" },
    project: { projectNo: "BP-G260505743", customerOrg: "同济医院" },
  }
  const saved = process.env.APP_BASE_URL
  afterEach(() => {
    if (saved === undefined) delete process.env.APP_BASE_URL
    else process.env.APP_BASE_URL = saved
  })

  it("created：主题含编号与「已创建并指派给您」", () => {
    delete process.env.APP_BASE_URL
    const { subject, text } = buildReminderBody(task, "created")
    expect(subject).toContain("BP-G260505743-B01")
    expect(subject).toContain("已创建并指派给您")
    expect(text).toContain("标准分析")
    expect(text).toContain("/bioinfo-tasks/task-1")
  })

  it("reassigned：用「已指派给您」", () => {
    const { subject } = buildReminderBody(task, "reassigned")
    expect(subject).toContain("已指派给您")
  })

  it("无项目号 → 未编号草稿", () => {
    const { subject } = buildReminderBody({ ...task, project: { projectNo: null, customerOrg: "x" } }, "created")
    expect(subject).toContain("未编号草稿")
  })

  it("APP_BASE_URL 前缀拼进链接、去尾斜杠", () => {
    process.env.APP_BASE_URL = "https://sc.example.com/"
    const { text } = buildReminderBody(task, "created")
    expect(text).toContain("https://sc.example.com/bioinfo-tasks/task-1")
  })
})
