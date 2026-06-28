import { recordOperation } from "@/lib/operation-log"
import { OperationAction } from "@/lib/enums"
import { isNotifyEnabled, sendMail } from "@/lib/notify/mailer"
import {
  buildTaskOrderData,
  renderTaskOrderMarkdown,
  taskOrderFilename,
} from "@/lib/bioinfo/task-order"

/**
 * 生信任务指派提醒（重构 §6.5：仅做「任务提醒」这一最小必需，非通用通知中心）。
 * 触发：生信任务创建带分析负责人 / 指派变更。收件人=分析负责人。可附任务单。
 * 全程不抛出（提醒失败不阻断业务动作）；发送结果写操作日志，便于审计。
 */

export type BioinfoTaskForNotify = {
  id: string
  taskNo: string
  analysisType: string | null
  projectId: string
  analyst: { name: string; email: string | null } | null
  project: { projectNo: string | null; customerOrg: string }
}

export type NotifyReason = "created" | "reassigned"

export function buildReminderBody(
  task: BioinfoTaskForNotify,
  reason: NotifyReason
): { subject: string; text: string } {
  const projectNo = task.project.projectNo ?? "未编号草稿"
  const verb = reason === "created" ? "已创建并指派给您" : "已指派给您"
  const subject = `【生信任务】${task.taskNo} ${verb}（${projectNo}）`
  const baseUrl = process.env.APP_BASE_URL?.replace(/\/$/, "") ?? ""
  const text = [
    `${task.analyst?.name ?? ""} 您好，`,
    "",
    `生信任务 ${task.taskNo} ${verb}。`,
    `项目：${projectNo} · ${task.project.customerOrg}`,
    `分析类型：${task.analysisType ?? "待定"}`,
    "",
    `请登录单细胞云平台查看并处理：${baseUrl}/bioinfo-tasks/${task.id}`,
    "",
    "— 单细胞云平台",
  ].join("\n")
  return { subject, text }
}

/** 尽力附上任务单 Markdown（系统视角渲染，失败则不附） */
async function buildTaskOrderAttachment(projectId: string) {
  try {
    const data = await buildTaskOrderData({ id: "system", role: "admin" }, projectId)
    if (!data) return undefined
    return [
      {
        filename: taskOrderFilename(data),
        content: renderTaskOrderMarkdown(data),
        contentType: "text/markdown; charset=utf-8",
      },
    ]
  } catch {
    return undefined
  }
}

export async function notifyBioinfoTaskAssigned(
  task: BioinfoTaskForNotify,
  reason: NotifyReason,
  operatorId: string
): Promise<void> {
  try {
    if (!isNotifyEnabled()) return
    const to = task.analyst?.email
    if (!to) {
      console.info(`[notify] 生信任务 ${task.taskNo} 无分析负责人邮箱，跳过提醒`)
      return
    }

    const { subject, text } = buildReminderBody(task, reason)
    const attachments = await buildTaskOrderAttachment(task.projectId)
    const result = await sendMail({ to, subject, text, attachments })

    await recordOperation({
      entityType: "bioinfo_task",
      entityId: task.id,
      action: OperationAction.assign,
      operatorId,
      after: {
        kind: "notify",
        reason,
        to,
        subject,
        transport: result.transport,
        delivered: result.delivered,
        ...(result.error ? { error: result.error } : {}),
      },
    })
  } catch (error) {
    // 提醒不阻断业务：任何异常仅记录
    console.error(`[notify] 生信任务 ${task.taskNo} 提醒失败:`, error)
  }
}
