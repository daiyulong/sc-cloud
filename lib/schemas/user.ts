import { z } from "zod"
import { UserRole } from "@/lib/enums"

const roleValues = Object.values(UserRole) as [UserRole, ...UserRole[]]

/** 管理员创建用户 */
export const createUserSchema = z.object({
  username: z.string().min(2, "用户名至少 2 位").max(50),
  email: z.string().email("邮箱格式不正确"),
  name: z.string().min(1, "请输入姓名"),
  password: z.string().min(8, "密码至少 8 位"),
  role: z.enum(roleValues),
  department: z.string().optional(),
  phone: z.string().optional(),
})
export type CreateUserInput = z.infer<typeof createUserSchema>

/** 管理员更新用户（不含改密码，密码走独立动作） */
export const updateUserSchema = z.object({
  email: z.string().email("邮箱格式不正确").optional(),
  name: z.string().min(1).optional(),
  role: z.enum(roleValues).optional(),
  department: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})
export type UpdateUserInput = z.infer<typeof updateUserSchema>
