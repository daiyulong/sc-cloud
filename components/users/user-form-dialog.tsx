"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"
import {
  USER_ROLE_LABELS,
  UserRole,
  type UserRole as UserRoleValue,
} from "@/lib/enums"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type UserFormValue = {
  id: string
  username: string
  email: string
  name: string
  role: UserRoleValue
  department: string | null
  phone: string | null
}

type UserFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  /** edit 模式必传 */
  user?: UserFormValue
  /** 当前登录用户 id：编辑自己时角色锁定（防自我降级锁死） */
  selfId: string
}

function formString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim()
}

/** 新建/编辑用户 Dialog（仅管理员入口可达） */
export function UserFormDialog({ open, onOpenChange, mode, user, selfId }: UserFormDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()
  const [role, setRole] = React.useState<UserRoleValue>(user?.role ?? UserRole.viewer)
  const [prevOpen, setPrevOpen] = React.useState(open)

  // 每次打开重置角色选择（uncontrolled 输入随 Dialog 卸载自动重置）
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setRole(user?.role ?? UserRole.viewer)
  }

  const isSelf = mode === "edit" && user?.id === selfId

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const payload: Record<string, unknown> = {
      email: formString(formData, "email"),
      name: formString(formData, "name"),
      role,
      department: formString(formData, "department") || null,
      phone: formString(formData, "phone") || null,
    }
    if (mode === "create") {
      payload.username = formString(formData, "username")
      payload.password = formString(formData, "password")
    }

    startTransition(async () => {
      const response = await fetch(
        mode === "create" ? "/api/admin/users" : `/api/admin/users/${user?.id}`,
        {
          method: mode === "create" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(result?.error || "保存用户失败")
        return
      }
      toast.success(mode === "create" ? "用户已创建" : "用户已更新")
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "新建用户" : "编辑用户"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "创建后将初始密码告知用户，并提醒首次登录后修改。"
              : `${user?.username} · 用户名不可修改`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {mode === "create" && (
              <Field>
                <FieldLabel htmlFor="user-username">用户名</FieldLabel>
                <Input
                  id="user-username"
                  name="username"
                  required
                  minLength={2}
                  maxLength={50}
                  pattern="[a-zA-Z0-9_.\-]+"
                  title="仅支持字母、数字、_ . -"
                  autoComplete="off"
                />
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="user-name">姓名</FieldLabel>
              <Input id="user-name" name="name" defaultValue={user?.name} required maxLength={50} />
            </Field>
            <Field>
              <FieldLabel htmlFor="user-email">邮箱</FieldLabel>
              <Input
                id="user-email"
                name="email"
                type="email"
                defaultValue={user?.email}
                required
                autoComplete="off"
              />
            </Field>
            <Field>
              <FieldLabel>角色</FieldLabel>
              <Select
                value={role}
                onValueChange={(value) => setRole(value as UserRoleValue)}
                disabled={isSelf}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {Object.values(UserRole).map((value) => (
                      <SelectItem key={value} value={value}>
                        {USER_ROLE_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {isSelf && <FieldDescription>不能修改自己的角色。</FieldDescription>}
            </Field>
            <Field>
              <FieldLabel htmlFor="user-department">部门</FieldLabel>
              <Input id="user-department" name="department" defaultValue={user?.department ?? ""} />
            </Field>
            <Field>
              <FieldLabel htmlFor="user-phone">手机号</FieldLabel>
              <Input id="user-phone" name="phone" defaultValue={user?.phone ?? ""} autoComplete="off" />
            </Field>
            {mode === "create" && (
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="user-password">初始密码</FieldLabel>
                <Input
                  id="user-password"
                  name="password"
                  required
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                />
                <FieldDescription>至少 8 位。</FieldDescription>
              </Field>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              取消
            </Button>
            <Button type="submit" disabled={isPending}>
              {mode === "create" ? "创建用户" : "保存修改"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
