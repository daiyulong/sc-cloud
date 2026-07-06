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
import { Input } from "@/components/ui/input"

export type ConfirmProjectBody = { projectNo: string }

type ProjectConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isPending: boolean
  onConfirm: (body: ConfirmProjectBody) => void
  /** 覆盖默认描述文字 */
  description?: string
  /** 是否强制要求填写项目编号（默认 false，确认项目时允许留空；补填编号时为 true） */
  projectNoRequired?: boolean
}

/**
 * 确认项目 Dialog：PM 录入项目编号（委托单号，上游给定）后进入收样流程。
 * 项目编号在确认这一刻才有，故确认动作是表单而非直接按钮。
 * 需求 2026-07：确认时 projectNo 可留空（推迟到样本接收后补填）；
 * fillProjectNo 动作用同一 Dialog，projectNoRequired=true。
 */
export function ProjectConfirmDialog({
  open,
  onOpenChange,
  isPending,
  onConfirm,
  description = "录入项目编号（委托单号）后项目进入收样流程；确认时如尚无样本批次，会同时创建 1 个待到样批次。",
  projectNoRequired = false,
}: ProjectConfirmDialogProps) {
  const [projectNo, setProjectNo] = React.useState("")
  const [showError, setShowError] = React.useState(false)
  const [prevOpen, setPrevOpen] = React.useState(open)

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setProjectNo("")
      setShowError(false)
    }
  }

  function handleConfirm() {
    const trimmed = projectNo.trim()
    if (projectNoRequired && !trimmed) {
      setShowError(true)
      return
    }
    // 传空字符串时后端按 null 处理（confirmProjectSchema.projectNo 为 nullableString）
    onConfirm({ projectNo: trimmed })
  }

  const invalid = showError && projectNoRequired && !projectNo.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认项目</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Field data-invalid={invalid || undefined}>
          <FieldLabel htmlFor="confirm-project-no">项目编号（委托单号）</FieldLabel>
          <Input
            id="confirm-project-no"
            value={projectNo}
            onChange={(event) => setProjectNo(event.target.value)}
            placeholder="如 BP-G260504587"
            aria-invalid={invalid || undefined}
            autoComplete="off"
          />
          {invalid && (
            <FieldDescription className="text-destructive">
              {projectNoRequired ? "请输入项目编号。" : "请输入项目编号（委托单号）。"}
            </FieldDescription>
          )}
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            确认项目
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
