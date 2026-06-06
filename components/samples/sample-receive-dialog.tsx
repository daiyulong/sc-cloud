"use client"

import * as React from "react"
import {
  RECEIVE_STATUS_LABELS,
  ReceiveStatus,
  type ReceiveStatus as ReceiveStatusValue,
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

/** 当前本地时间的 datetime-local 输入值（YYYY-MM-DDTHH:mm） */
function nowInputValue() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export type ReceiveSampleBody = {
  receivedAt: string | null
  receiveStatus: ReceiveStatusValue
  abnormalNote: string | null
}

type SampleReceiveDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sampleNo: string
  isPending: boolean
  onConfirm: (body: ReceiveSampleBody) => void
}

/** 接收样本表单 Dialog：实际接收时间 + 接收状态 + 条件必填的异常说明 */
export function SampleReceiveDialog({
  open,
  onOpenChange,
  sampleNo,
  isPending,
  onConfirm,
}: SampleReceiveDialogProps) {
  const [receivedAt, setReceivedAt] = React.useState("")
  const [receiveStatus, setReceiveStatus] = React.useState<ReceiveStatusValue>(
    ReceiveStatus.normal
  )
  const [abnormalNote, setAbnormalNote] = React.useState("")
  const [showError, setShowError] = React.useState(false)
  const [prevOpen, setPrevOpen] = React.useState(open)

  // 每次打开重置为「现在 + 正常接收」（渲染期间调整状态，避免 effect 级联渲染）
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setReceivedAt(nowInputValue())
      setReceiveStatus(ReceiveStatus.normal)
      setAbnormalNote("")
      setShowError(false)
    }
  }

  const noteRequired = receiveStatus === ReceiveStatus.abnormal
  const invalid = showError && noteRequired && !abnormalNote.trim()

  function handleConfirm() {
    if (noteRequired && !abnormalNote.trim()) {
      setShowError(true)
      return
    }
    onConfirm({
      receivedAt: receivedAt || null,
      receiveStatus,
      abnormalNote: abnormalNote.trim() || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>接收样本</DialogTitle>
          <DialogDescription>{sampleNo} · 登记实际接收信息</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="sample-received-at">实际接收时间</FieldLabel>
            <Input
              id="sample-received-at"
              type="datetime-local"
              value={receivedAt}
              onChange={(event) => setReceivedAt(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>接收状态</FieldLabel>
            <Select
              value={receiveStatus}
              onValueChange={(value) => setReceiveStatus(value as ReceiveStatusValue)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {Object.values(ReceiveStatus).map((value) => (
                    <SelectItem key={value} value={value}>
                      {RECEIVE_STATUS_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          {noteRequired && (
            <Field data-invalid={invalid || undefined}>
              <FieldLabel htmlFor="sample-abnormal-note">异常说明</FieldLabel>
              <Textarea
                id="sample-abnormal-note"
                value={abnormalNote}
                onChange={(event) => setAbnormalNote(event.target.value)}
                placeholder="破损 / 超温 / 延迟 / 污染…"
                aria-invalid={invalid || undefined}
              />
              <FieldDescription className={invalid ? "text-destructive" : undefined}>
                异常接收必填。
              </FieldDescription>
            </Field>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            接收样本
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
