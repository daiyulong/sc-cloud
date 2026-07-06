"use client"

import Link from "next/link"
import { Upload } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import {
  RECEIVE_STATUS_LABELS,
  ReceiveStatus,
  type ReceiveStatus as ReceiveStatusValue,
} from "@/lib/enums"
import { cn } from "@/lib/utils"
import { useCloseWorkItemPanel } from "@/components/detail/use-close-work-item-panel"
import { useEntityAction } from "@/components/detail/use-entity-action"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
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

/**
 * 从 Excel 第一张表提取第 3 列（C 列）文本。
 * 空单元格跳过；返回去空后的样本名数组（未 trim）。
 */
function extractSampleNamesFromSheet(
  workbook: import("xlsx").WorkBook
): string[] | null {
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return null
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return null
  const range = sheet["!ref"]
  if (!range) return null

  // 解析 ref 如 "A1:Z100" 获取最大行号
  const refMatch = range.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/)
  if (!refMatch) return null
  const [, , startRowStr, , endRowStr] = refMatch
  const startRow = parseInt(startRowStr, 10)
  const endRow = parseInt(endRowStr, 10)

  const names: string[] = []
  // 从第 2 行起取（第 1 行为表头，跳过不取）
  for (let row = startRow + 1; row <= endRow; row++) {
    // 第 3 列 = 列号 3（C），A=1, B=2, C=3
    const colIndex = 3
    const cellRef =
      String.fromCharCode(64 + colIndex) + row /* e.g. C2, C3 … */
    const cell = sheet[cellRef]
    const val =
      cell?.v !== undefined && cell?.v !== null
        ? String(cell.v).trim()
        : ""
    if (val) names.push(val)
  }
  return names.length > 0 ? names : null
}

export type ReceiveSampleBody = {
  batchNo: string | null
  species: string
  tissueType: string
  experimentType: string
  transportCondition: string
  sampleCount: string | null
  receivedAt: string | null
  receiveStatus: ReceiveStatusValue
  abnormalNote: string | null
  sampleNames?: string[]
}

type SampleReceiveFormProps = {
  endpoint: string
  sampleNo: string
  batchNo?: string | null
  param?: string
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
 * 登记接收是待到样批次的主任务，直接内嵌在 WorkItemPanel 中，不再通过二级弹窗承载。
 */
export function SampleReceiveForm({
  endpoint,
  sampleNo,
  batchNo: initialBatchNo,
  param = "view",
  projectId,
  projectNo,
  expectedArrival,
  species: initialSpecies,
  tissueType: initialTissueType,
  experimentType: initialExperimentType,
  transportCondition: initialTransportCondition,
  sampleCount,
}: SampleReceiveFormProps) {
  const [batchNo, setBatchNo] = React.useState(initialBatchNo ?? "")
  const [species, setSpecies] = React.useState(initialSpecies ?? "")
  const [tissueType, setTissueType] = React.useState(initialTissueType ?? "")
  const [experimentType, setExperimentType] = React.useState(initialExperimentType ?? "")
  const [transportCondition, setTransportCondition] = React.useState(
    initialTransportCondition ?? ""
  )
  const [countInput, setCountInput] = React.useState(sampleCount == null ? "" : String(sampleCount))
  const [receivedAt, setReceivedAt] = React.useState(() => nowInputValue())
  const [receiveStatus, setReceiveStatus] = React.useState<ReceiveStatusValue>(
    ReceiveStatus.normal
  )
  const [abnormalNote, setAbnormalNote] = React.useState("")
  const [issues, setIssues] = React.useState<Set<string>>(() => new Set())
  const [sampleNamesText, setSampleNamesText] = React.useState("")
  const [showError, setShowError] = React.useState(false)
  const closePanel = useCloseWorkItemPanel(param)
  const { run, isPending } = useEntityAction()

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
  // 异常接收：至少勾一个类型或填一段说明。
  const noteMissing = noteRequired && issues.size === 0 && !abnormalNote.trim()
  const noteInvalid = showError && noteMissing
  const hasContext = Boolean(
    projectNo || (expectedArrival && expectedArrival !== "-") || sampleCount != null
  )

  // 解析 sampleNamesText 为数组（供校验 / 提交用）
  const sampleNamesArray = sampleNamesText
    .split(/[、，]/)
    .map((s) => s.trim())
    .filter(Boolean)

  // 样本名数量与样本数量不一致时阻断
  const namesCountMismatch =
    sampleNamesText.trim().length > 0 &&
    sampleNamesArray.length !== countValue

  // 单条样本名超长检测（取第一个超长的显示）
  const nameTooLong = sampleNamesArray.find((n) => n.length > 64)

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

  async function handleExcelUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast.error("请上传 .xlsx 或 .xls 文件")
      return
    }
    try {
      const XLSX = await import("xlsx")
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: "array" })
      const names = extractSampleNamesFromSheet(workbook)
      if (!names) {
        toast.error("Excel 第 3 列为空，请检查文件内容")
        return
      }
      setSampleNamesText(names.join("、"))
      toast.success(`已提取 ${names.length} 个样本名`)
    } catch {
      toast.error("Excel 解析失败，请检查文件格式")
    }
    // 清空 input 以便重复选择同一文件时仍能触发 change
    event.target.value = ""
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (missingInfo || noteMissing || namesCountMismatch || nameTooLong) {
      setShowError(true)
      return
    }
    const body: ReceiveSampleBody = {
      batchNo: batchNo.trim() || null,
      species: species.trim(),
      tissueType: tissueType.trim(),
      experimentType: experimentType.trim(),
      transportCondition: transportCondition.trim(),
      sampleCount: countInput.trim(),
      receivedAt: receivedAt || null,
      receiveStatus,
      abnormalNote: composeAbnormalNote(),
    }
    if (sampleNamesArray.length > 0) {
      body.sampleNames = sampleNamesArray
    }
    run(endpoint, "登记接收", body)
  }

  function infoInvalid(value: string) {
    return showError && !value.trim()
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="flex flex-col gap-5">
          <div>
            <h3 className="text-sm font-medium">登记接收</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {sampleNo} · 核对样本信息并登记实际到样。
            </p>
          </div>

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

          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="receive-batch-no">样品编号 (YP)</FieldLabel>
              <Input
                id="receive-batch-no"
                value={batchNo}
                onChange={(event) => setBatchNo(event.target.value)}
                placeholder="YP-xxxx…"
              />
            </Field>
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
          </FieldGroup>

          {showError && missingInfo && (
            <FieldDescription className="text-destructive">
              物种 / 组织类型 / 实验类型 / 运输条件 / 样本数量为必填，样本数量至少为 1。
            </FieldDescription>
          )}

          {/* 样品名录入 */}
          <Field
            data-invalid={
              (showError && (namesCountMismatch || Boolean(nameTooLong))) || undefined
            }
          >
            <FieldLabel htmlFor="receive-sample-names">样品名</FieldLabel>
            <div className="flex items-start gap-2">
              <Textarea
                id="receive-sample-names"
                value={sampleNamesText}
                onChange={(event) => setSampleNamesText(event.target.value)}
                placeholder="多个样本名用「、」分隔，如 S1、S2、S3"
                className="min-h-20 flex-1 resize-y"
              />
              <label
                htmlFor="excel-upload"
                className={cn(
                  "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                  "file:hidden"
                )}
              >
                <Upload data-icon="inline-start" aria-hidden="true" />
                Excel 提取
                <input
                  id="excel-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleExcelUpload}
                />
              </label>
            </div>
            <FieldDescription>
              手动输入或上传 Excel（提取第 3 列样本名）。填写后需与样本数量一致方可提交。
            </FieldDescription>
            {showError && namesCountMismatch && (
              <FieldDescription className="text-destructive">
                样本名数量（{sampleNamesArray.length}）与样本数量（{countValue}）不一致，请补齐或删减。
              </FieldDescription>
            )}
            {showError && nameTooLong && (
              <FieldDescription className="text-destructive">
                样本名「{nameTooLong}」超过 64 字符，请缩短。
              </FieldDescription>
            )}
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
                        "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                        on
                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                          : "border-input bg-background text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {issue}
                    </button>
                  )
                })}
              </div>
              <Textarea
                id="receive-abnormal-note"
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
      </div>

      <div className="flex shrink-0 justify-end gap-2 border-t bg-background px-6 py-4">
        <Button type="button" variant="outline" onClick={closePanel} disabled={isPending}>
          取消
        </Button>
        <Button type="submit" disabled={isPending}>
          确认接收
        </Button>
      </div>
    </form>
  )
}
