"use client"

import * as React from "react"
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
import { Textarea } from "@/components/ui/textarea"

type ReasonDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  reasonLabel?: string
  required?: boolean
  destructive?: boolean
  isPending: boolean
  onConfirm: (reason: string) => void
}

/** 带原因输入的动作确认 Dialog（标记异常 / 恢复 / 终止等共用） */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  reasonLabel = "原因",
  required = false,
  destructive = false,
  isPending,
  onConfirm,
}: ReasonDialogProps) {
  const [reason, setReason] = React.useState("")
  const [showError, setShowError] = React.useState(false)
  const [prevOpen, setPrevOpen] = React.useState(open)

  // 每次打开重置内容（渲染期间调整状态，避免 effect 级联渲染）
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setReason("")
      setShowError(false)
    }
  }

  function handleConfirm() {
    const trimmed = reason.trim()
    if (required && !trimmed) {
      setShowError(true)
      return
    }
    onConfirm(trimmed)
  }

  const invalid = showError && required && !reason.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <Field data-invalid={invalid || undefined}>
          <FieldLabel htmlFor="action-reason">
            {reasonLabel}
            {required ? "" : "（可选）"}
          </FieldLabel>
          <Textarea
            id="action-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="记录原因…"
            aria-invalid={invalid || undefined}
          />
          {invalid && <FieldDescription className="text-destructive">请填写{reasonLabel}。</FieldDescription>}
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            取消
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isPending}
          >
            {title}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
