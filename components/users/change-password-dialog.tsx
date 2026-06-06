"use client"

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

type ChangePasswordDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** 修改自己的密码（用户菜单入口） */
export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const [isPending, startTransition] = React.useTransition()
  const [mismatch, setMismatch] = React.useState(false)

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const oldPassword = String(formData.get("oldPassword") ?? "")
    const newPassword = String(formData.get("newPassword") ?? "")
    const confirmPassword = String(formData.get("confirmPassword") ?? "")

    if (newPassword !== confirmPassword) {
      setMismatch(true)
      return
    }
    setMismatch(false)

    startTransition(async () => {
      const response = await fetch("/api/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(result?.error || "修改密码失败")
        return
      }
      toast.success("密码已修改")
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>修改密码</DialogTitle>
          <DialogDescription>修改后当前登录保持有效，下次登录使用新密码。</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="old-password">当前密码</FieldLabel>
            <Input
              id="old-password"
              name="oldPassword"
              type="password"
              required
              autoComplete="current-password"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="new-password">新密码</FieldLabel>
            <Input
              id="new-password"
              name="newPassword"
              type="password"
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
            />
            <FieldDescription>至少 8 位，且不能与当前密码相同。</FieldDescription>
          </Field>
          <Field data-invalid={mismatch || undefined}>
            <FieldLabel htmlFor="confirm-password">确认新密码</FieldLabel>
            <Input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              aria-invalid={mismatch || undefined}
            />
            {mismatch && (
              <FieldDescription className="text-destructive">两次输入的新密码不一致。</FieldDescription>
            )}
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
              修改密码
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
