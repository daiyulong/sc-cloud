import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { OperationAction } from "@/lib/enums"

export interface RecordOperationParams {
  entityType: string
  entityId: string
  action: OperationAction
  operatorId: string
  before?: unknown
  after?: unknown
  /** 传入事务客户端则纳入调用方事务（关键动作必须与业务写在同一事务，规格 §5.1.3/4） */
  tx?: Prisma.TransactionClient
}

function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === undefined || value === null
    ? Prisma.JsonNull
    : (value as Prisma.InputJsonValue)
}

/**
 * 写操作日志（规格 §9.8）。项目时间线由操作日志 + 业务记录汇总而成。
 * - 有 tx：作为调用方事务的一部分写入（失败回滚整体）。
 * - 无 tx：独立写入，失败仅记录不抛出（日志不应阻断主流程）。
 */
export async function recordOperation(params: RecordOperationParams): Promise<void> {
  const { tx, before, after, ...rest } = params
  const data: Prisma.OperationLogCreateInput = {
    entityType: rest.entityType,
    entityId: rest.entityId,
    action: rest.action,
    operator: { connect: { id: rest.operatorId } },
    beforeData: toJson(before),
    afterData: toJson(after),
  }

  if (tx) {
    await tx.operationLog.create({ data })
    return
  }
  try {
    await prisma.operationLog.create({ data })
  } catch (e) {
    console.error("写操作日志失败:", e)
  }
}
