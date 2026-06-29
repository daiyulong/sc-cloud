import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { OperationAction, UserRole, type UserRole as UserRoleValue } from "@/lib/enums"
import { buildProjectScope } from "@/lib/auth/role-scope"
import { canActAsStaff } from "@/lib/auth/action-roles"
import { recordOperation } from "@/lib/operation-log"
import { readDeliveryFile, saveDeliveryFile } from "@/lib/storage/local"
import { isNotifyEnabled, sendMail } from "@/lib/notify/mailer"
import type { CreateSequencingDeliveryInput } from "@/lib/schemas/sequencing-delivery"

export type SequencingDeliveryOperator = { id: string; role?: UserRoleValue }

/** 登记测序交付 = 操作类动作，全员在岗可做（除 viewer），见 ADR-0001。 */
export function canRegisterDelivery(role: string | undefined): boolean {
  return canActAsStaff(role)
}

export class SequencingDeliveryDomainError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message)
    this.name = "SequencingDeliveryDomainError"
  }
}

/** 路由层统一映射本领域错误为 HTTP 响应；非本领域错误返回 null 交给通用处理。 */
export function handleSequencingDeliveryError(error: unknown): NextResponse | null {
  if (error instanceof SequencingDeliveryDomainError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  return null
}

const deliveryInclude = {
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.SequencingDeliveryInclude

export type DeliveryView = Prisma.SequencingDeliveryGetPayload<{ include: typeof deliveryInclude }>

/** 校验项目在操作者可见范围内，返回最小项目信息；不可见即 404。 */
async function ensureProjectVisible(operator: SequencingDeliveryOperator, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { AND: [{ id: projectId }, buildProjectScope(operator.role)] },
    select: { id: true, projectNo: true, customerOrg: true },
  })
  if (!project) throw new SequencingDeliveryDomainError("项目不存在或无权访问", 404)
  return project
}

/** 列出项目下的测序交付（按可见范围；时间倒序）。 */
export async function listProjectDeliveries(
  operator: SequencingDeliveryOperator,
  projectId: string
): Promise<DeliveryView[]> {
  await ensureProjectVisible(operator, projectId)
  return prisma.sequencingDelivery.findMany({
    where: { projectId },
    include: deliveryInclude,
    orderBy: { createdAt: "desc" },
  })
}

type DeliveryFile = { bytes: Buffer; name: string; mime: string }

/**
 * 登记一次测序交付：贴数据存储链接 + 可选上传厂商 excel/邮件存证。
 * 取代「实验员转发邮件给生信」——落库可追踪，并 best-effort 通知生信组。
 */
export async function createSequencingDelivery(
  operator: SequencingDeliveryOperator,
  projectId: string,
  input: CreateSequencingDeliveryInput,
  file?: DeliveryFile
): Promise<DeliveryView> {
  if (!canRegisterDelivery(operator.role)) {
    throw new SequencingDeliveryDomainError("登记测序交付没有操作权限", 403)
  }
  const project = await ensureProjectVisible(operator, projectId)

  const storageUrl = input.storageUrl ?? null
  if (!storageUrl && !file) {
    throw new SequencingDeliveryDomainError("请至少提供数据存储链接，或上传厂商交付文件", 400)
  }

  const created = await prisma.sequencingDelivery.create({
    data: { projectId, storageUrl, note: input.note ?? null, createdById: operator.id },
  })

  let delivery = created
  if (file) {
    const key = await saveDeliveryFile(created.id, file.bytes)
    delivery = await prisma.sequencingDelivery.update({
      where: { id: created.id },
      data: { attachmentKey: key, attachmentName: file.name, attachmentMime: file.mime },
    })
  }

  await recordOperation({
    entityType: "sequencing_delivery",
    entityId: delivery.id,
    action: OperationAction.create,
    operatorId: operator.id,
    after: { delivery, projectNo: project.projectNo },
  })

  // 通知生信组「数据已到、可取数分析」——best-effort，失败不阻断登记。
  void notifyBioinfoOfDelivery(project, delivery).catch(() => {})

  const full = await prisma.sequencingDelivery.findUnique({
    where: { id: delivery.id },
    include: deliveryInclude,
  })
  return full ?? { ...delivery, createdBy: { id: operator.id, name: "" } }
}

/** 鉴权代理读交付存证文件：校验该交付所属项目在可见范围内，再读本地磁盘。 */
export async function readDeliveryAttachment(
  operator: SequencingDeliveryOperator,
  deliveryId: string
): Promise<{ bytes: Buffer; mediaType: string; filename: string }> {
  const delivery = await prisma.sequencingDelivery.findFirst({
    where: { AND: [{ id: deliveryId }, { project: buildProjectScope(operator.role) }] },
    select: { attachmentKey: true, attachmentName: true, attachmentMime: true },
  })
  if (!delivery?.attachmentKey) {
    throw new SequencingDeliveryDomainError("交付文件不存在或无权访问", 404)
  }
  const bytes = await readDeliveryFile(delivery.attachmentKey)
  return {
    bytes,
    mediaType: delivery.attachmentMime ?? "application/octet-stream",
    filename: delivery.attachmentName ?? "delivery",
  }
}

async function notifyBioinfoOfDelivery(
  project: { projectNo: string | null; customerOrg: string },
  delivery: { storageUrl: string | null; attachmentName: string | null; note: string | null }
) {
  if (!isNotifyEnabled()) return
  const analysts = await prisma.user.findMany({
    where: { role: UserRole.bioinfo_analyst, isActive: true },
    select: { email: true },
  })
  const to = analysts.map((a) => a.email).filter(Boolean).join(",")
  if (!to) return

  const label = project.projectNo ?? project.customerOrg
  const lines = [
    `项目 ${project.projectNo ?? "(未编号)"}（${project.customerOrg}）已登记一次测序交付，数据已到。`,
    delivery.storageUrl ? `数据位置：${delivery.storageUrl}` : null,
    delivery.attachmentName ? `交付文件：${delivery.attachmentName}` : null,
    delivery.note ? `备注：${delivery.note}` : null,
    "请到生信工位查看并据此开展分析。",
  ].filter(Boolean) as string[]

  await sendMail({ to, subject: `[测序交付] ${label}`, text: lines.join("\n") })
}
