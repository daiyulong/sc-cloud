"use client"

import * as React from "react"
import { toast } from "sonner"
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

const IGNORE = "__ignore__"

export type AlignRow = {
  rawText?: string | null
  sampleName: string | null
  concentration: number | null
  viability: number | null
  aggregationRate: number | null
  suggestedSampleId: string | null
}
export type AlignLeaf = { id: string; sampleName: string | null; batchNo: string | null }
export type AlignmentData = {
  image: { id: string; ocrStatus: string; ocrError?: string | null; confirmedAt?: string | null }
  rows: AlignRow[]
  leaves: AlignLeaf[]
}

type EditRow = {
  sampleId: string
  sampleName: string
  concentration: string
  viability: string
  aggregationRate: string
}

function toEdit(r: AlignRow): EditRow {
  return {
    sampleId: r.suggestedSampleId ?? IGNORE,
    sampleName: r.sampleName ?? "",
    concentration: r.concentration?.toString() ?? "",
    viability: r.viability?.toString() ?? "",
    aggregationRate: r.aggregationRate?.toString() ?? "",
  }
}
function numOrNull(v: string): number | null {
  const t = v.trim()
  return t === "" ? null : Number(t)
}

/**
 * 识别结果对齐 + 人工确认（重构 §6）：左原图、右逐行编辑 + 指派到候选样本叶子。
 * 居中 Dialog（从详情抽屉内部触发，避免与右侧 ?view 详情抽屉双右浮层）；识别仅预填，确认才写回。
 */
export function RecordAlignmentDialog({
  open,
  onOpenChange,
  data,
  onConfirmed,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: AlignmentData
  onConfirmed: () => void
}) {
  const { image, leaves } = data
  const [rows, setRows] = React.useState<EditRow[]>(() => data.rows.map(toEdit))
  const [pending, setPending] = React.useState(false)
  const reconfirm = Boolean(image.confirmedAt)
  const recognized = image.ocrStatus === "done"

  function update(i: number, patch: Partial<EditRow>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  const included = rows.filter((r) => r.sampleId !== IGNORE)
  const usedLeafIds = new Set(included.map((r) => r.sampleId))
  const dupCount = included.length - usedLeafIds.size

  async function confirm() {
    if (!recognized) return
    if (included.length === 0) return toast.error("请至少为一行指派样本")
    if (dupCount > 0) return toast.error("多行指派到了同一个样本，请调整")
    for (const r of included) {
      const v = numOrNull(r.viability)
      const a = numOrNull(r.aggregationRate)
      if ((v != null && (v < 0 || v > 100)) || (a != null && (a < 0 || a > 100))) {
        return toast.error("活率 / 结团率须在 0-100")
      }
    }
    setPending(true)
    try {
      const body = {
        reconfirm,
        rows: included.map((r) => ({
          sampleId: r.sampleId,
          sampleName: r.sampleName.trim() || null,
          concentration: numOrNull(r.concentration),
          viability: numOrNull(r.viability),
          aggregationRate: numOrNull(r.aggregationRate),
        })),
      }
      const res = await fetch(`/api/experiment-record-images/${image.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) return void toast.error(json.error ?? "确认失败")
      toast.success(`已确认 ${json.data.confirmed} 行，写入样本名与质控`)
      onConfirmed()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setPending(false)
    }
  }

  const leafLabel = (l: AlignLeaf) =>
    `${l.sampleName || "未命名"}${l.batchNo ? ` · ${l.batchNo}` : ""}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>核对识别结果{reconfirm ? "（重新确认）" : ""}</DialogTitle>
          <DialogDescription>
            识别仅预填，请逐行核对/修正并指派到样本后确认；活率/结团率为 0-100，确认后写入样本名与质控。
          </DialogDescription>
        </DialogHeader>

        {!recognized ? (
          <p className="py-6 text-sm text-muted-foreground">
            识别未成功（{image.ocrStatus}
            {image.ocrError ? `：${image.ocrError}` : ""}）。原图已存证，请关闭后用「录入质控」手工填写。
          </p>
        ) : (
          <div className="flex flex-1 gap-4 overflow-hidden">
            <div className="w-2/5 shrink-0 overflow-auto rounded-md border bg-muted/30 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- 私有鉴权代理动态图，不走 next/image */}
              <img
                src={`/api/experiment-record-images/${image.id}/file`}
                alt="实验记录原图"
                className="w-full rounded"
              />
            </div>
            <div className="flex-1 overflow-auto pr-1">
              {rows.length !== leaves.length && (
                <p className="mb-2 text-xs text-amber-600">
                  识别 {rows.length} 行，候选样本 {leaves.length} 个，数目不一致——请逐行核对指派，多余行设为「忽略」。
                </p>
              )}
              <div className="flex flex-col gap-3">
                {rows.map((r, i) => (
                  <div key={i} className="flex flex-col gap-2 rounded-md border p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Field>
                        <FieldLabel htmlFor={`align-name-${i}`}>样本名</FieldLabel>
                        <Input
                          id={`align-name-${i}`}
                          value={r.sampleName}
                          onChange={(e) => update(i, { sampleName: e.target.value })}
                          placeholder="未命名"
                        />
                      </Field>
                      <Field>
                        <FieldLabel>指派样本</FieldLabel>
                        <Select value={r.sampleId} onValueChange={(v) => update(i, { sampleId: v })}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value={IGNORE}>忽略此行</SelectItem>
                              {leaves.map((l) => (
                                <SelectItem
                                  key={l.id}
                                  value={l.id}
                                  disabled={usedLeafIds.has(l.id) && r.sampleId !== l.id}
                                >
                                  {leafLabel(l)}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Field>
                        <FieldLabel htmlFor={`align-conc-${i}`}>浓度</FieldLabel>
                        <Input
                          id={`align-conc-${i}`}
                          type="number"
                          value={r.concentration}
                          onChange={(e) => update(i, { concentration: e.target.value })}
                          placeholder="个/ul"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`align-via-${i}`}>活率 %</FieldLabel>
                        <Input
                          id={`align-via-${i}`}
                          type="number"
                          value={r.viability}
                          onChange={(e) => update(i, { viability: e.target.value })}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`align-agg-${i}`}>结团率 %</FieldLabel>
                        <Input
                          id={`align-agg-${i}`}
                          type="number"
                          value={r.aggregationRate}
                          onChange={(e) => update(i, { aggregationRate: e.target.value })}
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            取消
          </Button>
          <Button onClick={confirm} disabled={pending || !recognized}>
            {reconfirm ? "重新确认" : "确认写回"}（{included.length} 行）
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
