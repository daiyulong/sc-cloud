import { z } from "zod"
import { UserRole } from "@/lib/enums"
import { nullableString, optionalString } from "@/lib/schemas/common"

const roleValues = Object.values(UserRole) as [UserRole, ...UserRole[]]

export const userRoleSchema = z.enum(roleValues)

const passwordSchema = z.string().min(8, "密码至少 8 位").max(72, "密码最长 72 位")

/** 管理员创建用户 */
export const createUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "用户名至少 2 位")
    .max(50, "用户名最长 50 位")
    .regex(/^[a-zA-Z0-9_.-]+$/, "用户名仅支持字母、数字、_ . -"),
  email: z.string().trim().email("邮箱格式不正确"),
  name: z.string().trim().min(1, "请输入姓名").max(50),
  password: passwordSchema,
  role: userRoleSchema,
  // phone 在库中唯一，空值必须落 null 而不是 ""（否则第二个空手机号触发唯一冲突）
  department: nullableString,
  phone: nullableString,
})
export type CreateUserInput = z.infer<typeof createUserSchema>

/** 管理员更新用户（不含改密码，密码走独立动作） */
export const updateUserSchema = z
  .object({
    email: z.string().trim().email("邮箱格式不正确").optional(),
    name: z.string().trim().min(1, "请输入姓名").max(50).optional(),
    role: userRoleSchema.optional(),
    department: nullableString,
    phone: nullableString,
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) => Object.keys(value).some((key) => value[key as keyof typeof value] !== undefined),
    { message: "至少提供一个要更新的字段" }
  )
export type UpdateUserInput = z.infer<typeof updateUserSchema>

/** 管理员重置用户密码（无自助找回通道，管理员重置是唯一恢复路径） */
export const resetPasswordSchema = z.object({
  password: passwordSchema,
})
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

/** 用户修改自己的密码 */
export const changeOwnPasswordSchema = z
  .object({
    oldPassword: z.string().min(1, "请输入当前密码"),
    newPassword: passwordSchema,
  })
  .refine((value) => value.oldPassword !== value.newPassword, {
    message: "新密码不能与当前密码相同",
    path: ["newPassword"],
  })
export type ChangeOwnPasswordInput = z.infer<typeof changeOwnPasswordSchema>

/** 用户列表查询 */
export const userListQuerySchema = z.object({
  q: optionalString,
  role: userRoleSchema.optional(),
  /** URL 参数形态，服务层转 boolean */
  isActive: z.enum(["true", "false"]).optional(),
  page: optionalString,
  limit: optionalString,
})
export type UserListQuery = z.infer<typeof userListQuerySchema>
