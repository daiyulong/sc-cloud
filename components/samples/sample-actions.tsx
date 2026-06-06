"use client"

import { useRouter } from "next/navigation"
import { AlertTriangle, PackageCheck } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import {
  RECEIVE_STATUS_LABELS,
  ReceiveStatus,
  type ReceiveStatus as ReceiveStatusValue,
  type SampleStatus as SampleStatusValue,
} from "@/lib/enums"
import { getAvailableSampleActions } from "@/lib/samples/rules"
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

type SampleActionsProps = {
  sampleId: string
  status: SampleStatusValue
  role?: string
}

/** 当前本地时间的 datetime-local 输入值（YYYY-MM-DDTHH:mm） */
function nowInputValue() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export function SampleActions({ sampleId, status, role }: SampleActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()
  const [receiveStatus, setReceiveStatus] = React.useState<ReceiveStatusValue>(
    ReceiveStatus.normal
  )
  const receivedAtRef = React.useRef<HTMLInputElement>(null)
  const abnormalNoteRef = React.useRef<HTMLTextAreaElement>(null)
  const reasonRef = React.useRef<HTMLTextAreaElement>(null)
  const actions = getAvailableSampleActions(status, role)

  function runAction(path: string, label: string, body: Record<string, unknown>) {
    startTransition(async () => {
      const response = await fetch(`/api/samples/${sampleId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(result?.error || `${label}失败`)
        return
      }
      toast.success(`${label}成功`)
      router.refresh()
    })
  }

  if (actions.length === 0) {
    return <p className="text-sm text-muted-foreground">当前状态暂无可执行样本动作。</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {actions.includes("receive") && (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="sample-received-at">实际接收时间</FieldLabel>
            <Input
              id="sample-received-at"
              ref={receivedAtRef}
              type="datetime-local"
              defaultValue={nowInputValue()}
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
          {receiveStatus === ReceiveStatus.abnormal && (
            <Field>
              <FieldLabel htmlFor="sample-abnormal-note">异常说明</FieldLabel>
              <Textarea
                id="sample-abnormal-note"
                ref={abnormalNoteRef}
                placeholder="破损 / 超温 / 延迟 / 污染…"
              />
              <FieldDescription>异常接收必填。</FieldDescription>
            </Field>
          )}
          <div>
            <Button
              disabled={isPending}
              onClick={() =>
                runAction("receive", "接收样本", {
                  receivedAt: receivedAtRef.current?.value || null,
                  receiveStatus,
                  abnormalNote: abnormalNoteRef.current?.value || null,
                })
              }
            >
              <PackageCheck data-icon="inline-start" aria-hidden="true" />
              接收样本
            </Button>
          </div>
        </FieldGroup>
      )}

      {actions.includes("markAbnormal") && (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="sample-abnormal-reason">异常原因</FieldLabel>
            <Textarea id="sample-abnormal-reason" ref={reasonRef} placeholder="记录原因…" />
            <FieldDescription>只标记样本异常，不影响项目状态。</FieldDescription>
          </Field>
          <div>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() =>
                runAction("mark-abnormal", "登记样本异常", {
                  reason: reasonRef.current?.value ?? "",
                })
              }
            >
              <AlertTriangle data-icon="inline-start" aria-hidden="true" />
              登记样本异常
            </Button>
          </div>
        </FieldGroup>
      )}
    </div>
  )
}
