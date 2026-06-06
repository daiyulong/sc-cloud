import { z } from "zod"

/** 登录表单（账号支持 用户名/邮箱/手机号） */
export const loginSchema = z.object({
  account: z.string().min(1, "请输入账号"),
  password: z.string().min(1, "请输入密码"),
})
export type LoginInput = z.infer<typeof loginSchema>

/** 修改自己的密码 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "请输入当前密码"),
    newPassword: z.string().min(8, "新密码至少 8 位"),
    confirmPassword: z.string().min(1, "请确认新密码"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "两次输入的新密码不一致",
    path: ["confirmPassword"],
  })
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
