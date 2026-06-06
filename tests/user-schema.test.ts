import { describe, expect, it } from "vitest"
import {
  changeOwnPasswordSchema,
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
  userListQuerySchema,
} from "@/lib/schemas/user"
import { UserRole } from "@/lib/enums"

const validCreate = {
  username: "zhang.san",
  email: "zhangsan@example.com",
  name: "张三",
  password: "password123",
  role: UserRole.sample_receiver,
}

describe("createUserSchema", () => {
  it("合法输入通过，空 department/phone 落 null（phone 库内唯一，不能落空串）", () => {
    const parsed = createUserSchema.parse({ ...validCreate, department: "", phone: " " })
    expect(parsed.department).toBeNull()
    expect(parsed.phone).toBeNull()
  })

  it("密码不足 8 位拒绝", () => {
    expect(() => createUserSchema.parse({ ...validCreate, password: "1234567" })).toThrow()
  })

  it("用户名含非法字符拒绝", () => {
    expect(() => createUserSchema.parse({ ...validCreate, username: "张三" })).toThrow()
    expect(() => createUserSchema.parse({ ...validCreate, username: "a b" })).toThrow()
  })

  it("邮箱格式错误拒绝", () => {
    expect(() => createUserSchema.parse({ ...validCreate, email: "not-an-email" })).toThrow()
  })

  it("非法角色拒绝", () => {
    expect(() => createUserSchema.parse({ ...validCreate, role: "super_admin" })).toThrow()
  })
})

describe("updateUserSchema", () => {
  it("空对象拒绝（至少一个字段）", () => {
    expect(() => updateUserSchema.parse({})).toThrow()
  })

  it("单字段更新通过；phone 空串转 null", () => {
    expect(updateUserSchema.parse({ name: "李四" })).toEqual({ name: "李四" })
    expect(updateUserSchema.parse({ phone: "" }).phone).toBeNull()
  })

  it("不接受 password 字段（密码走独立动作）", () => {
    const parsed = updateUserSchema.parse({ name: "李四", password: "hack12345" })
    expect("password" in parsed).toBe(false)
  })
})

describe("resetPasswordSchema / changeOwnPasswordSchema", () => {
  it("重置密码至少 8 位", () => {
    expect(() => resetPasswordSchema.parse({ password: "short" })).toThrow()
    expect(resetPasswordSchema.parse({ password: "newpass123" }).password).toBe("newpass123")
  })

  it("修改密码：新旧相同拒绝", () => {
    expect(() =>
      changeOwnPasswordSchema.parse({ oldPassword: "samepass123", newPassword: "samepass123" })
    ).toThrow()
  })

  it("修改密码：旧密码必填、新密码至少 8 位", () => {
    expect(() =>
      changeOwnPasswordSchema.parse({ oldPassword: "", newPassword: "newpass123" })
    ).toThrow()
    expect(() =>
      changeOwnPasswordSchema.parse({ oldPassword: "oldpass123", newPassword: "short" })
    ).toThrow()
    expect(
      changeOwnPasswordSchema.parse({ oldPassword: "oldpass123", newPassword: "newpass123" })
    ).toEqual({ oldPassword: "oldpass123", newPassword: "newpass123" })
  })
})

describe("userListQuerySchema", () => {
  it("isActive 仅接受 true/false 字符串", () => {
    expect(userListQuerySchema.parse({ isActive: "true" }).isActive).toBe("true")
    expect(() => userListQuerySchema.parse({ isActive: "yes" })).toThrow()
  })

  it("空查询通过", () => {
    expect(userListQuerySchema.parse({})).toEqual({})
  })
})
