import { UserRole, type UserRole as UserRoleValue } from "@/lib/enums"

/**
 * 角色落地页：工位制下登录后直达本角色工位，取代已删除的 `/dashboard`。
 * 纯函数、不引用 Prisma —— 供 Edge 中间件（auth.config）与 client 侧栏复用。
 * 销售 / 项目经理 / 管理员 / 查看者 → 项目工位；其余各落本职工位。
 */
export function landingPathForRole(role?: UserRoleValue | string | null): string {
  switch (role) {
    case UserRole.sample_receiver:
      return "/intake"
    case UserRole.lab_operator:
      return "/lab"
    case UserRole.bioinfo_analyst:
      return "/bioinfo-tasks"
    default:
      return "/projects"
  }
}
