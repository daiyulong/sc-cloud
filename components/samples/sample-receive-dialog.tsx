"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import {
  RECEIVE_STATUS_LABELS,
  ReceiveStatus,
  type ReceiveStatus as ReceiveStatusValue,
} from "@/lib/enums"
import { cn } from "@/lib/utils"
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
  /** 上下文条（可选）：跨项目收样队列里锚定「这批属于哪个项目 / 预计到样 / 几个样本」 */
  projectId?: string
  projectNo?: string
  expectedArrival?: string
  species?: string | null
  tissueType?: string | null
  experimentType?: string | null
  transportCondition?: string | null
  sampleCount?: number | null
}

// 整批异常类型（勾选后组进异常说明，结构化快速录入；自由文本补细节）。
const ABNORMAL_ISSUES = ["温度异常", "容器破损", "泄漏/污染", "数量不符"] as const

/**
 * 登记接收表单：沿用建项目/样本编辑时已填的批次信息，到样时核对；
 * 缺失项由收样员补齐，并记录实际到样（时间/状态/异常说明）。
 */
export function SampleReceiveDialog({
  open,
  onOpenChange,
  sampleNo,
  isPending,
  onConfirm,
  surface,
  projectId,
  projectNo,
  expectedArrival,
  species: initialSpecies,
  tissueType: initialTissueType,
  experimentType: initialExperimentType,
  transportCondition: initialTransportCondition,
  sampleCount,
}: SampleReceiveDialogProps) {
  const [species, setSpecies] = React.useState("")
  const [tissueType, setTissueType] = React.useState("")
  const [experimentType, setExperimentType] = React.useState("")
  const [transportCondition, setTransportCondition] = React.useState("")
  const [countInput, setCountInput] = React.useState("")
  const [receivedAt, setReceivedAt] = React.useState("")
  const [receiveStatus, setReceiveStatus] = React.useState<ReceiveStatusValue>(
    ReceiveStatus.normal
  )
  const [abnormalNote, setAbnormalNote] = React.useState("")
  const [issues, setIssues] = React.useState<Set<string>>(() => new Set())
  const [showError, setShowError] = React.useState(false)
  const [prevOpen, setPrevOpen] = React.useState(open)

  // 每次打开重置（渲染期间调整状态，避免 effect 级联渲染）
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setSpecies(initialSpecies ?? "")
      setTissueType(initialTissueType ?? "")
      setExperimentType(initialExperimentType ?? "")
      setTransportCondition(initialTransportCondition ?? "")
      setCountInput(sampleCount == null ? "" : String(sampleCount))
      setReceivedAt(nowInputValue())
      setReceiveStatus(ReceiveStatus.normal)
      setAbnormalNote("")
      setIssues(new Set())
      setShowError(false)
    }
  }

  const noteRequired = receiveStatus === ReceiveStatus.abnormal
  const countMissing = !countInput.trim()
  const countValue = Number(countInput)
  const countInvalidValue =
    !countMissing && (!Number.isInteger(countValue) || countValue < 1)
  const missingInfo =
    !species.trim() ||
    !tissueType.trim() ||
    !experimentType.trim() ||
    !transportCondition.trim() ||
    countMissing ||
    countInvalidValue
  // 异常接收：至少勾一个类型或填一段说明
  const noteMissing = noteRequired && issues.size === 0 && !abnormalNote.trim()
  const noteInvalid = showError && noteMissing
  const hasContext = Boolean(projectNo || (expectedArrival && expectedArrival !== "-") || sampleCount != null)

  function toggleIssue(issue: string) {
    setIssues((prev) => {
      const next = new Set(prev)
      if (next.has(issue)) next.delete(issue)
      else next.add(issue)
      return next
    })
  }

  function composeAbnormalNote() {
    if (!noteRequired) return null
    const tags = ABNORMAL_ISSUES.filter((issue) => issues.has(issue)).join("、")
    return [tags, abnormalNote.trim()].filter(Boolean).join(" · ") || null
  }

  function handleConfirm() {
    if (missingInfo || noteMissing) {
      setShowError(true)
      return
    }
    onConfirm({
      species: species.trim(),
      tissueType: tissueType.trim(),
      experimentType: experimentType.trim(),
      transportCondition: transportCondition.trim(),
      sampleCount: countInput.trim(),
      receivedAt: receivedAt || null,
      receiveStatus,
      abnormalNote: composeAbnormalNote(),
    })
  }

  function infoInvalid(value: string) {
    return showError && !value.trim()
  }

  const allInfoPrefilled = Boolean(
    initialSpecies?.trim() &&
      initialTissueType?.trim() &&
      initialExperimentType?.trim() &&
      initialTransportCondition?.trim() &&
      sampleCount
  )

  return (
    <ActionOverlay
      surface={surface}
      open={open}
      onOpenChange={onOpenChange}
      title="登记接收"
      description={`${sampleNo} · ${allInfoPrefilled ? "核对样本信息" : "补全样本信息"}并登记实际到样`}
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
          {hasContext && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-md bg-muted/40 px-3 py-2 text-xs">
              {projectNo && (
                <span>
                  <span className="text-muted-foreground">项目 </span>
                  {projectId ? (
                    <Link href={`/projects/${projectId}`} className="font-medium hover:underline">
                      {projectNo}
                    </Link>
                  ) : (
                    <span className="font-medium">{projectNo}</span>
                  )}
                </span>
              )}
              {expectedArrival && expectedArrival !== "-" && (
                <span>
                  <span className="text-muted-foreground">预计到样 </span>
                  <span className="font-medium tabular-nums">{expectedArrival}</span>
                </span>
              )}
              {sampleCount != null && (
                <span>
                  <span className="text-muted-foreground">样本数 </span>
                  <span className="font-medium tabular-nums">{sampleCount}</span>
                </span>
              )}
            </div>
          )}
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
            <Field data-invalid={(showError && (countMissing || countInvalidValue)) || undefined}>
              <FieldLabel htmlFor="receive-count">样本数量</FieldLabel>
              <Input
                id="receive-count"
                type="number"
                min={1}
                step={1}
                value={countInput}
                onChange={(event) => setCountInput(event.target.value)}
                placeholder="实物数量，至少 1"
                aria-invalid={(showError && (countMissing || countInvalidValue)) || undefined}
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
              物种 / 组织类型 / 实验类型 / 运输条件 / 样本数量为必填，样本数量至少为 1。
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
              <FieldLabel>异常类型</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {ABNORMAL_ISSUES.map((issue) => {
                  const on = issues.has(issue)
                  return (
                    <button
                      type="button"
                      key={issue}
                      onClick={() => toggleIssue(issue)}
                      aria-pressed={on}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                        on
                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                          : "border-input bg-background text-muted-foreground hover:bg-accent"
                      )}
                    >
                      <AlertTriangle className="size-3.5" aria-hidden="true" />
                      {issue}
                    </button>
                  )
                })}
              </div>
              <Textarea
                id="receive-abnormal-note"
                className="mt-2"
                value={abnormalNote}
                onChange={(event) => setAbnormalNote(event.target.value)}
                placeholder="补充说明：破损程度 / 超温时长 / 延迟原因…"
                aria-invalid={noteInvalid || undefined}
              />
              <FieldDescription className={noteInvalid ? "text-destructive" : undefined}>
                异常接收需选择类型或填写说明。
              </FieldDescription>
            </Field>
          )}
        </div>
    </ActionOverlay>
  )
}
