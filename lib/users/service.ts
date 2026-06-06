import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { recordOperation } from "@/lib/operation-log"
import { OperationAction } from "@/lib/enums"
import type {
  ChangeOwnPasswordInput,
  CreateUserInput,
  UpdateUserInput,
  UserListQuery,
} from "@/lib/schemas/user"

const BCRYPT_ROUNDS = 10

export class UserDomainError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message)
    this.name = "UserDomainError"
  }
}

export function handleUserDomainError(error: unknown) {
  if (error instanceof UserDomainError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  return null
}

/** 用户对外字段（绝不包含 password 哈希） */
const userSelect = {
  id: true,
  username: true,
  email: true,
  name: true,
  role: true,
  department: true,
  phone: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect

export type UserListItem = Prisma.UserGetPayload<{ select: typeof userSelect }>

function buildUserListWhere(query: UserListQuery): Prisma.UserWhereInput {
  const filters: Prisma.UserWhereInput[] = []
  if (query.q) {
    filters.push({
      OR: [
        { name: { contains: query.q, mode: "insensitive" } },
        { username: { contains: query.q, mode: "insensitive" } },
        { email: { contains: query.q, mode: "insensitive" } },
      ],
    })
  }
  if (query.role) filters.push({ role: query.role })
  if (query.isActive) filters.push({ isActive: query.isActive === "true" })
  return filters.length > 0 ? { AND: filters } : {}
}

export async function listUsers(query: UserListQuery, pagination: { skip: number; limit: number }) {
  const where = buildUserListWhere(query)
  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.user.count({ where }),
  ])
  return { data, total }
}

export async function createUser(operatorId: string, input: CreateUserInput) {
  const { password, ...rest } = input
  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS)
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        ...rest,
        department: rest.department ?? null,
        phone: rest.phone ?? null,
        password: hashed,
      },
      select: userSelect,
    })
    await recordOperation({
      entityType: "user",
      entityId: user.id,
      action: OperationAction.create,
      operatorId,
      after: user,
      tx,
    })
    return user
  })
}

export async function updateUser(operatorId: string, id: string, input: UpdateUserInput) {
  const before = await prisma.user.findUnique({ where: { id }, select: userSelect })
  if (!before) throw new UserDomainError("用户不存在", 404)

  // 防锁死守卫：管理员不能降级自己的角色、不能在更新中停用自己
  if (id === operatorId) {
    if (input.role !== undefined && input.role !== before.role) {
      throw new UserDomainError("不能修改自己的角色", 403)
    }
    if (input.isActive === false) {
      throw new UserDomainError("不能停用自己的账号", 403)
    }
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: input,
      select: userSelect,
    })
    await recordOperation({
      entityType: "user",
      entityId: id,
      action: OperationAction.update,
      operatorId,
      before,
      after: user,
      tx,
    })
    return user
  })
}

export async function toggleUserActive(operatorId: string, id: string) {
  if (id === operatorId) throw new UserDomainError("不能停用自己的账号", 403)

  const before = await prisma.user.findUnique({ where: { id }, select: userSelect })
  if (!before) throw new UserDomainError("用户不存在", 404)

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: { isActive: !before.isActive },
      select: userSelect,
    })
    await recordOperation({
      entityType: "user",
      entityId: id,
      action: OperationAction.status_change,
      operatorId,
      before: { isActive: before.isActive },
      after: { isActive: user.isActive },
      tx,
    })
    return user
  })
}

/** 管理员重置用户密码。日志只记事件，不落任何密码相关数据 */
export async function resetUserPassword(operatorId: string, id: string, password: string) {
  const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } })
  if (!exists) throw new UserDomainError("用户不存在", 404)

  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS)
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { password: hashed } })
    await recordOperation({
      entityType: "user",
      entityId: id,
      action: OperationAction.update,
      operatorId,
      after: { event: "password_reset" },
      tx,
    })
  })
}

/** 用户修改自己的密码：校验旧密码后更新 */
export async function changeOwnPassword(userId: string, input: ChangeOwnPasswordInput) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true },
  })
  if (!user) throw new UserDomainError("用户不存在", 404)

  const isValid = await bcrypt.compare(input.oldPassword, user.password)
  if (!isValid) throw new UserDomainError("当前密码不正确", 400)

  const hashed = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS)
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { password: hashed } })
    await recordOperation({
      entityType: "user",
      entityId: userId,
      action: OperationAction.update,
      operatorId: userId,
      after: { event: "password_change" },
      tx,
    })
  })
}
