"use client"

import * as React from "react"
import {
  RECEIVE_STATUS_LABELS,
  ReceiveStatus,
  type ReceiveStatus as ReceiveStatusValue,
} from "@/lib/enums"
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
import { Textarea } from "@/components/ui/textarea"

/** 当前本地时间的 datetime-local 输入值（YYYY-MM-DDTHH:mm） */
function nowInputValue() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export type ReceiveSampleBody = {
  species: string
  tissueType: string
  experimentType: string
  transportCondition: string
  sampleCount: string | null
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
  surface?: ActionSurface
}

/**
 * 登记接收表单 Dialog：建项目时只有编号+数量，到样时由收样员一次补全
 * 样本信息（物种/组织/实验类型/运输条件）+ 记录实际到样（时间/状态/异常说明）。
 */
export function SampleReceiveDialog({
  open,
  onOpenChange,
  sampleNo,
  isPending,
  onConfirm,
  surface,
}: SampleReceiveDialogProps) {
  const [species, setSpecies] = React.useState("")
  const [tissueType, setTissueType] = React.useState("")
  const [experimentType, setExperimentType] = React.useState("")
  const [transportCondition, setTransportCondition] = React.useState("")
  const [sampleCount, setSampleCount] = React.useState("")
  const [receivedAt, setReceivedAt] = React.useState("")
  const [receiveStatus, setReceiveStatus] = React.useState<ReceiveStatusValue>(
    ReceiveStatus.normal
  )
  const [abnormalNote, setAbnormalNote] = React.useState("")
  const [showError, setShowError] = React.useState(false)
  const [prevOpen, setPrevOpen] = React.useState(open)

  // 每次打开重置（渲染期间调整状态，避免 effect 级联渲染）
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setSpecies("")
      setTissueType("")
      setExperimentType("")
      setTransportCondition("")
      setSampleCount("")
      setReceivedAt(nowInputValue())
      setReceiveStatus(ReceiveStatus.normal)
      setAbnormalNote("")
      setShowError(false)
    }
  }

  const noteRequired = receiveStatus === ReceiveStatus.abnormal
  const missingInfo =
    !species.trim() || !tissueType.trim() || !experimentType.trim() || !transportCondition.trim()
  const noteInvalid = showError && noteRequired && !abnormalNote.trim()

  function handleConfirm() {
    if (missingInfo || (noteRequired && !abnormalNote.trim())) {
      setShowError(true)
      return
    }
    onConfirm({
      species: species.trim(),
      tissueType: tissueType.trim(),
      experimentType: experimentType.trim(),
      transportCondition: transportCondition.trim(),
      sampleCount: sampleCount.trim() || null,
      receivedAt: receivedAt || null,
      receiveStatus,
      abnormalNote: abnormalNote.trim() || null,
    })
  }

  function infoInvalid(value: string) {
    return showError && !value.trim()
  }

  return (
    <ActionOverlay
      surface={surface}
      open={open}
      onOpenChange={onOpenChange}
      title="登记接收"
      description={`${sampleNo} · 补全样本信息并登记实际到样`}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            登记接收
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={infoInvalid(species) || undefined}>
              <FieldLabel htmlFor="receive-species">物种</FieldLabel>
              <Input
                id="receive-species"
                value={species}
                onChange={(event) => setSpecies(event.target.value)}
                placeholder="人 / 小鼠…"
                aria-invalid={infoInvalid(species) || undefined}
              />
            </Field>
            <Field data-invalid={infoInvalid(tissueType) || undefined}>
              <FieldLabel htmlFor="receive-tissue">组织类型</FieldLabel>
              <Input
                id="receive-tissue"
                value={tissueType}
                onChange={(event) => setTissueType(event.target.value)}
                placeholder="肺 / 肝 / 外周血…"
                aria-invalid={infoInvalid(tissueType) || undefined}
              />
            </Field>
            <Field data-invalid={infoInvalid(experimentType) || undefined}>
              <FieldLabel htmlFor="receive-exp-type">实验类型</FieldLabel>
              <Input
                id="receive-exp-type"
                value={experimentType}
                onChange={(event) => setExperimentType(event.target.value)}
                placeholder="scRNA / snRNA / 空间…"
                aria-invalid={infoInvalid(experimentType) || undefined}
              />
            </Field>
            <Field data-invalid={infoInvalid(transportCondition) || undefined}>
              <FieldLabel htmlFor="receive-transport">运输条件</FieldLabel>
              <Input
                id="receive-transport"
                value={transportCondition}
                onChange={(event) => setTransportCondition(event.target.value)}
                placeholder="干冰 / 冰袋…"
                aria-invalid={infoInvalid(transportCondition) || undefined}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="receive-count">样本数量</FieldLabel>
              <Input
                id="receive-count"
                type="number"
                min={0}
                step={1}
                value={sampleCount}
                onChange={(event) => setSampleCount(event.target.value)}
                placeholder="留空保持建项目时的数量"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="receive-at">实际接收时间</FieldLabel>
              <Input
                id="receive-at"
                type="datetime-local"
                value={receivedAt}
                onChange={(event) => setReceivedAt(event.target.value)}
              />
            </Field>
          </div>
          {showError && missingInfo && (
            <FieldDescription className="text-destructive">
              物种 / 组织类型 / 实验类型 / 运输条件为必填。
            </FieldDescription>
          )}
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
            <Field data-invalid={noteInvalid || undefined}>
              <FieldLabel htmlFor="receive-abnormal-note">异常说明</FieldLabel>
              <Textarea
                id="receive-abnormal-note"
                value={abnormalNote}
                onChange={(event) => setAbnormalNote(event.target.value)}
                placeholder="破损 / 超温 / 延迟 / 污染…"
                aria-invalid={noteInvalid || undefined}
              />
              <FieldDescription className={noteInvalid ? "text-destructive" : undefined}>
                异常接收必填。
              </FieldDescription>
            </Field>
          )}
        </div>
    </ActionOverlay>
  )
}
