import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import type { UserRole } from "@/lib/enums"

// 通用路由参数类型，消除各 route.ts 的重复定义
export type RouteContext<T = { id: string }> = {
  params: Promise<T>
}

/** 校验 JWT 中的用户是否存在且激活（防数据库重置后的幽灵会话），并回传最新 role */
async function verifyUser(userId: string) {
  const { prisma } = await import("@/lib/prisma")
  return prisma.user.findUnique({
    where: { id: userId, isActive: true },
    select: { id: true, role: true },
  })
}

/**
 * 认证检查，返回当前会话或 401。
 * 用法：
 *   const [session, err] = await requireAuth()
 *   if (err) return err
 */
export async function requireAuth() {
  const session = await auth()
  if (!session?.user?.id) {
    return [null, NextResponse.json({ error: "未授权" }, { status: 401 })] as const
  }
  const dbUser = await verifyUser(session.user.id)
  if (!dbUser) {
    return [
      null,
      NextResponse.json({ error: "用户不存在或已停用，请重新登录" }, { status: 401 }),
    ] as const
  }
  // 用 DB 最新 role 覆盖可能过期的 JWT role
  session.user.role = dbUser.role
  return [session, null] as const
}

/**
 * 角色级权限检查（§3.2）。行级数据范围另见 @/lib/auth/role-scope。
 * 用法：
 *   const [session, err] = await requireRole(["project_manager", "admin"])
 *   if (err) return err
 */
export async function requireRole(roles: UserRole[]) {
  const [session, authError] = await requireAuth()
  if (authError) return [null, authError] as const
  if (!roles.includes(session.user.role as UserRole)) {
    return [null, NextResponse.json({ error: "没有操作权限" }, { status: 403 })] as const
  }
  return [session, null] as const
}

/** 管理员专用快捷 */
export async function requireAdmin() {
  return requireRole(["admin"])
}

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

/** 解析分页参数（兼容 URLSearchParams 与 Server Component 的 searchParams 对象） */
export function parsePagination(
  params: URLSearchParams | { page?: string; limit?: string },
  defaultLimit = 20
) {
  const get = (key: string) =>
    params instanceof URLSearchParams
      ? params.get(key)
      : (params as Record<string, string | undefined>)[key]
  const page = Math.max(1, parseInt(get("page") || "1") || 1)
  const limit = Math.max(
    1,
    Math.min(100, parseInt(get("limit") || String(defaultLimit)) || defaultLimit)
  )
  const skip = (page - 1) * limit
  return { page, limit, skip }
}

/** 构建分页响应 */
export function paginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    } satisfies PaginationInfo,
  })
}

/**
 * 安全解析请求体 JSON——失败时抛出 SyntaxError，由 handleApiError 统一返回 400。
 * 替代各路由里散落的 `.catch(() => ({}))`，确保非法 JSON 给出明确错误信息。
 */
export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new SyntaxError("请求体格式错误，请提供合法的 JSON")
  }
}

/** 统一 API 错误处理 */
export function handleApiError(error: unknown, message: string) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "数据验证失败", details: error.issues }, { status: 400 })
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 })
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "记录不存在" }, { status: 404 })
    }
    if (error.code === "P2002") {
      return NextResponse.json({ error: "记录已存在（唯一约束冲突）" }, { status: 409 })
    }
  }
  console.error(`${message}:`, error)
  return NextResponse.json({ error: message }, { status: 500 })
}
