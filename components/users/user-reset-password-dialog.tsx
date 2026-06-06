"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"
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

type UserResetPasswordDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userName: string
}

/** 管理员重置用户密码：明文输入便于转告，提交后提示用户自行修改 */
export function UserResetPasswordDialog({
  open,
  onOpenChange,
  userId,
  userName,
}: UserResetPasswordDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const password = String(new FormData(event.currentTarget).get("password") ?? "").trim()

    startTransition(async () => {
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(result?.error || "重置密码失败")
        return
      }
      toast.success(`已重置 ${userName} 的密码`)
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>重置密码</DialogTitle>
          <DialogDescription>{userName} · 设置新密码并告知用户</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="reset-password">新密码</FieldLabel>
            <Input
              id="reset-password"
              name="password"
              required
              minLength={8}
              maxLength={72}
              autoComplete="off"
            />
            <FieldDescription>至少 8 位，明文显示便于转告；请提醒用户登录后自行修改。</FieldDescription>
          </Field>
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
              重置密码
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
