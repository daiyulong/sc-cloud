"use client"

import * as React from "react"
import { SUSPENSION_TYPE_LABELS, SuspensionType } from "@/lib/enums"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type RunMetricsBody = {
  suspensionType: string | null
  sequencingAmount: string | null
  capturedCells: string | null
  medianGenes: string | null
}

export type RunMetricsInitial = {
  suspensionType: string | null
  sequencingAmount: number | null
  capturedCells: number | null
  medianGenes: number | null
}

/** Radix Select 不接受空 value，用哨兵代表「未指定」，提交时映射回 null */
const NONE = "none"

type RunMetricsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskNo: string
  isPending: boolean
  initial: RunMetricsInitial
  onConfirm: (body: RunMetricsBody) => void
}

/** 录入产出指标表单：悬液类型 + 测序量/捕获细胞数/基因中位数（下机定量后补录，§6.8） */
export function RunMetricsDialog({
  open,
  onOpenChange,
  taskNo,
  isPending,
  initial,
  onConfirm,
}: RunMetricsDialogProps) {
  const [suspensionType, setSuspensionType] = React.useState(initial.suspensionType ?? NONE)
  const [sequencingAmount, setSequencingAmount] = React.useState(
    initial.sequencingAmount?.toString() ?? ""
  )
  const [capturedCells, setCapturedCells] = React.useState(initial.capturedCells?.toString() ?? "")
  const [medianGenes, setMedianGenes] = React.useState(initial.medianGenes?.toString() ?? "")
  const [prevOpen, setPrevOpen] = React.useState(open)

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setSuspensionType(initial.suspensionType ?? NONE)
      setSequencingAmount(initial.sequencingAmount?.toString() ?? "")
      setCapturedCells(initial.capturedCells?.toString() ?? "")
      setMedianGenes(initial.medianGenes?.toString() ?? "")
    }
  }

  const allEmpty =
    suspensionType === NONE &&
    sequencingAmount.trim() === "" &&
    capturedCells.trim() === "" &&
    medianGenes.trim() === ""

  function handleConfirm() {
    onConfirm({
      suspensionType: suspensionType === NONE ? null : suspensionType,
      sequencingAmount: sequencingAmount.trim() || null,
      capturedCells: capturedCells.trim() || null,
      medianGenes: medianGenes.trim() || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>录入产出指标</DialogTitle>
          <DialogDescription>{taskNo} · 下机定量（cellranger）后补录，供相似经验参考</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel>悬液类型</FieldLabel>
            <Select value={suspensionType} onValueChange={setSuspensionType}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={NONE}>未指定</SelectItem>
                  {Object.values(SuspensionType).map((value) => (
                    <SelectItem key={value} value={value}>
                      {SUSPENSION_TYPE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field>
              <FieldLabel htmlFor="rm-seq">测序量 (G)</FieldLabel>
              <Input
                id="rm-seq"
                type="number"
                min={0}
                step="any"
                value={sequencingAmount}
                onChange={(event) => setSequencingAmount(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="rm-cells">捕获细胞数</FieldLabel>
              <Input
                id="rm-cells"
                type="number"
                min={0}
                step="1"
                value={capturedCells}
                onChange={(event) => setCapturedCells(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="rm-genes">基因中位数</FieldLabel>
              <Input
                id="rm-genes"
                type="number"
                min={0}
                step="1"
                value={medianGenes}
                onChange={(event) => setMedianGenes(event.target.value)}
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={isPending || allEmpty}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
