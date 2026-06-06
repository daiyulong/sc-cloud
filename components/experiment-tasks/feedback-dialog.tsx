"use client"

import * as React from "react"
import {
  RESULT_STATUS_LABELS,
  ResultStatus,
  type ResultStatus as ResultStatusValue,
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
import { Textarea } from "@/components/ui/textarea"

export type FeedbackTaskBody = {
  resultStatus: ResultStatusValue
  resultFeedback: string
  loadedSampleCount: string | null
}

type FeedbackDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskNo: string
  isPending: boolean
  onConfirm: (body: FeedbackTaskBody) => void
}

/** 提交实验反馈表单 Dialog：结果状态 + 结果反馈（必填）+ 上机样本个数 */
export function FeedbackDialog({
  open,
  onOpenChange,
  taskNo,
  isPending,
  onConfirm,
}: FeedbackDialogProps) {
  const [resultStatus, setResultStatus] = React.useState<ResultStatusValue>(ResultStatus.normal_run)
  const [resultFeedback, setResultFeedback] = React.useState("")
  const [loadedSampleCount, setLoadedSampleCount] = React.useState("")
  const [showError, setShowError] = React.useState(false)
  const [prevOpen, setPrevOpen] = React.useState(open)

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setResultStatus(ResultStatus.normal_run)
      setResultFeedback("")
      setLoadedSampleCount("")
      setShowError(false)
    }
  }

  const invalid = showError && !resultFeedback.trim()

  function handleConfirm() {
    if (!resultFeedback.trim()) {
      setShowError(true)
      return
    }
    onConfirm({
      resultStatus,
      resultFeedback: resultFeedback.trim(),
      loadedSampleCount: loadedSampleCount.trim() || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>提交实验反馈</DialogTitle>
          <DialogDescription>{taskNo} · 录入上机结果与反馈，提交后任务完成</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel>结果状态</FieldLabel>
            <Select
              value={resultStatus}
              onValueChange={(value) => setResultStatus(value as ResultStatusValue)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {Object.values(ResultStatus).map((value) => (
                    <SelectItem key={value} value={value}>
                      {RESULT_STATUS_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="task-loaded-count">上机样本个数</FieldLabel>
            <Input
              id="task-loaded-count"
              type="number"
              min={0}
              step={1}
              value={loadedSampleCount}
              onChange={(event) => setLoadedSampleCount(event.target.value)}
              placeholder="实际上机数量"
            />
          </Field>
          <Field data-invalid={invalid || undefined}>
            <FieldLabel htmlFor="task-result-feedback">结果反馈</FieldLabel>
            <Textarea
              id="task-result-feedback"
              value={resultFeedback}
              onChange={(event) => setResultFeedback(event.target.value)}
              placeholder="实验结果与说明…"
              aria-invalid={invalid || undefined}
            />
            <FieldDescription className={invalid ? "text-destructive" : undefined}>
              结果反馈必填。
            </FieldDescription>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            提交反馈
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
