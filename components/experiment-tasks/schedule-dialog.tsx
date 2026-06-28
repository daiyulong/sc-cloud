"use client"

import * as React from "react"
import { todayString } from "@/lib/utils"
import { ActionOverlay, type ActionSurface } from "@/components/detail/action-overlay"
import { Button } from "@/components/ui/button"
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

export type OperatorOption = { id: string; name: string; department: string | null }

export type ScheduleTaskBody = {
  plannedDate: string
  operatorId: string | null
  runMethod: string | null
  department: string | null
}

const UNASSIGNED = "__unassigned__"

type ScheduleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskNo: string
  operatorOptions: OperatorOption[]
  isPending: boolean
  onConfirm: (body: ScheduleTaskBody) => void
  surface?: ActionSurface
}

/** 设置排期表单 Dialog：计划日期（必填）+ 实验负责人 + 上机方式 + 部门 */
export function ScheduleDialog({
  open,
  onOpenChange,
  taskNo,
  operatorOptions,
  isPending,
  onConfirm,
  surface,
}: ScheduleDialogProps) {
  const [plannedDate, setPlannedDate] = React.useState("")
  const [operatorId, setOperatorId] = React.useState(UNASSIGNED)
  const [runMethod, setRunMethod] = React.useState("")
  const [department, setDepartment] = React.useState("")
  const [showError, setShowError] = React.useState(false)
  const [prevOpen, setPrevOpen] = React.useState(open)

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setPlannedDate(todayString())
      setOperatorId(UNASSIGNED)
      setRunMethod("")
      setDepartment("")
      setShowError(false)
    }
  }

  const invalid = showError && !plannedDate

  function handleConfirm() {
    if (!plannedDate) {
      setShowError(true)
      return
    }
    onConfirm({
      plannedDate,
      operatorId: operatorId === UNASSIGNED ? null : operatorId,
      runMethod: runMethod.trim() || null,
      department: department.trim() || null,
    })
  }

  return (
    <ActionOverlay
      surface={surface}
      open={open}
      onOpenChange={onOpenChange}
      title="设置排期"
      description={`${taskNo} · 安排计划实验日期与负责人`}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            设置排期
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
          <Field data-invalid={invalid || undefined}>
            <FieldLabel htmlFor="task-planned-date">计划实验日期</FieldLabel>
            <Input
              id="task-planned-date"
              type="date"
              value={plannedDate}
              onChange={(event) => setPlannedDate(event.target.value)}
              aria-invalid={invalid || undefined}
            />
            {invalid && <FieldDescription className="text-destructive">请填写计划实验日期。</FieldDescription>}
          </Field>
          <Field>
            <FieldLabel>实验负责人</FieldLabel>
            <Select value={operatorId} onValueChange={setOperatorId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={UNASSIGNED}>未指派</SelectItem>
                  {operatorOptions.map((operator) => (
                    <SelectItem key={operator.id} value={operator.id}>
                      {operator.name}
                      {operator.department ? ` · ${operator.department}` : ""}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="task-run-method">上机方式</FieldLabel>
            <Input
              id="task-run-method"
              value={runMethod}
              onChange={(event) => setRunMethod(event.target.value)}
              placeholder="10x / GEM-X / Next GEM / 墨卓…"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="task-department">所属部门</FieldLabel>
            <Input
              id="task-department"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              placeholder="单细胞部 / 时空部…"
            />
          </Field>
        </div>
    </ActionOverlay>
  )
}
