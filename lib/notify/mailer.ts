/**
 * 邮件发送通道抽象（重构 §6.5 邮件任务提醒）。
 * 通道由 env 决定：配置 SMTP_HOST → 走 SMTP（nodemailer，境内企业邮箱/内网可控）；
 * 未配置 → dev 回退「日志通道」，仅 console 记录、不真实发送。
 * 总开关 NOTIFY_ENABLED=1 才启用；关时全链路 no-op。失败不抛出（提醒不阻断业务）。
 */

export type MailAttachment = { filename: string; content: string | Buffer; contentType?: string }
export type MailInput = {
  to: string
  subject: string
  text: string
  attachments?: MailAttachment[]
}
export type MailTransport = "smtp" | "log" | "disabled"
export type MailResult = { transport: MailTransport; delivered: boolean; error?: string }

export function isNotifyEnabled(): boolean {
  return process.env.NOTIFY_ENABLED === "1"
}

function smtpConfigured(): boolean {
  return !!process.env.SMTP_HOST
}

const mailFrom = () => process.env.MAIL_FROM ?? "no-reply@sc-cloud.local"

/** 发送一封邮件。返回所用通道与是否真实投递；任何异常都被吞掉并落到 error 字段。 */
export async function sendMail(input: MailInput): Promise<MailResult> {
  if (!isNotifyEnabled()) return { transport: "disabled", delivered: false }

  if (!smtpConfigured()) {
    // dev 回退：不真发，仅记录，便于本地联调
    console.info(
      `[notify:log] to=${input.to} subject=${input.subject}` +
        (input.attachments?.length ? ` attachments=${input.attachments.length}` : "")
    )
    return { transport: "log", delivered: false }
  }

  try {
    const nodemailer = await import("nodemailer")
    const port = Number(process.env.SMTP_PORT ?? 587)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      // SMTP_SECURE=1 强制 TLS（465）；否则按端口推断（465=true）
      secure: process.env.SMTP_SECURE === "1" || port === 465,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    })
    await transporter.sendMail({
      from: mailFrom(),
      to: input.to,
      subject: input.subject,
      text: input.text,
      attachments: input.attachments,
    })
    return { transport: "smtp", delivered: true }
  } catch (error) {
    return { transport: "smtp", delivered: false, error: (error as Error).message.slice(0, 300) }
  }
}
