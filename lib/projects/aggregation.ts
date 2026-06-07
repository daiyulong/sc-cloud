import type { Prisma } from "@prisma/client"
import { OperationAction, type ProjectStatus } from "@/lib/enums"
import { recordOperation } from "@/lib/operation-log"

/**
 * 聚合：推进项目状态并写操作日志（子实体动作驱动，§7.1）。
 * 实验任务和生信任务服务共用——两者都会在关键动作完成时级联推进项目状态。
 */
export async function advanceProjectStatus(
  tx: Prisma.TransactionClient,
  operator: { id: string },
  projectBefore: { status: string },
  projectId: string,
  next: (typeof ProjectStatus)[keyof typeof ProjectStatus],
  trigger: string
) {
  const projectAfter = await tx.project.update({
    where: { id: projectId },
    data: { status: next },
  })
  await recordOperation({
    tx,
    entityType: "project",
    entityId: projectId,
    action: OperationAction.status_change,
    operatorId: operator.id,
    before: projectBefore,
    after: { project: projectAfter, trigger },
  })
}
