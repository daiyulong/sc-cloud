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
import { Textarea } from "@/components/ui/textarea"

export type SubmitBioinfoBody = {
  analysisType: string | null
  deliverableNote: string | null
}

type SubmitDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskNo: string
  defaultAnalysisType?: string | null
  isPending: boolean
  onConfirm: (body: SubmitBioinfoBody) => void
}

/** 提交报告表单 Dialog：分析类型 + 交付物说明（报告交付日期在项目确认交付时落） */
export function SubmitDialog({
  open,
  onOpenChange,
  taskNo,
  defaultAnalysisType,
  isPending,
  onConfirm,
}: SubmitDialogProps) {
  const [analysisType, setAnalysisType] = React.useState("")
  const [deliverableNote, setDeliverableNote] = React.useState("")
  const [prevOpen, setPrevOpen] = React.useState(open)

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setAnalysisType(defaultAnalysisType ?? "")
      setDeliverableNote("")
    }
  }

  function handleConfirm() {
    onConfirm({
      analysisType: analysisType.trim() || null,
      deliverableNote: deliverableNote.trim() || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>提交报告</DialogTitle>
          <DialogDescription>{taskNo} · 提交后进入待交付，由项目经理确认交付</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="bioinfo-analysis-type">分析类型</FieldLabel>
            <Input
              id="bioinfo-analysis-type"
              value={analysisType}
              onChange={(event) => setAnalysisType(event.target.value)}
              placeholder="标准分析 / 高级分析 / 免疫组分析…"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="bioinfo-deliverable">交付物说明</FieldLabel>
            <Textarea
              id="bioinfo-deliverable"
              value={deliverableNote}
              onChange={(event) => setDeliverableNote(event.target.value)}
              placeholder="报告、矩阵文件、图表等…"
            />
            <FieldDescription>报告交付日期在项目经理确认交付时统一记录。</FieldDescription>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            提交报告
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
