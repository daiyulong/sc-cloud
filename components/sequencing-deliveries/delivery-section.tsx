"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Download, ExternalLink, LoaderCircle, Plus, Upload } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"

export type DeliveryItem = {
  id: string
  storageUrl: string | null
  attachmentName: string | null
  note: string | null
  createdAtLabel: string
  createdByName: string | null
}

type DeliverySectionProps = {
  projectId: string
  items: DeliveryItem[]
  /** 可登记（实验员/PM/管理员）；生信侧只读传 false */
  canRegister: boolean
}

/**
 * 测序交付区：外包测序回数据的登记 + 透传。
 * 实验员登记（贴数据存储链接 + 上传厂商 excel 存证）取代「转发邮件给生信」；
 * 生信侧只读看到数据位置与存证，据此取数分析。
 */
export function DeliverySection({ projectId, items, canRegister }: DeliverySectionProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">测序交付</h3>
        {canRegister && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Plus data-icon="inline-start" aria-hidden="true" />
            登记测序交付
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          暂无测序交付。外包测序回数据后，由实验员在此贴数据链接 / 上传厂商 excel，透传生信。
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm"
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {item.storageUrl ? (
                  <a
                    href={item.storageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
                  >
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                    数据位置
                  </a>
                ) : null}
                {item.attachmentName ? (
                  <a
                    href={`/api/projects/${projectId}/deliveries/${item.id}/file`}
                    className="inline-flex items-center gap-1 text-foreground hover:underline"
                  >
                    <Download className="size-3.5" aria-hidden="true" />
                    {item.attachmentName}
                  </a>
                ) : null}
              </div>
              {item.note ? <p className="text-muted-foreground">{item.note}</p> : null}
              <p className="text-xs text-muted-foreground">
                {item.createdByName ?? "—"} · {item.createdAtLabel}
              </p>
            </li>
          ))}
        </ul>
      )}

      {canRegister && (
        <RegisterDeliveryDialog projectId={projectId} open={open} onOpenChange={setOpen} />
      )}
    </div>
  )
}

function RegisterDeliveryDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [storageUrl, setStorageUrl] = React.useState("")
  const [note, setNote] = React.useState("")
  const [file, setFile] = React.useState<File | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [prevOpen, setPrevOpen] = React.useState(open)

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setStorageUrl("")
      setNote("")
      setFile(null)
    }
  }

  const canSubmit = storageUrl.trim() !== "" || file !== null

  async function onSubmit() {
    setBusy(true)
    try {
      const form = new FormData()
      if (storageUrl.trim()) form.append("storageUrl", storageUrl.trim())
      if (note.trim()) form.append("note", note.trim())
      if (file) form.append("file", file)
      const res = await fetch(`/api/projects/${projectId}/deliveries`, { method: "POST", body: form })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error ?? "登记失败")
        return
      }
      toast.success("已登记测序交付，并通知生信")
      onOpenChange(false)
      router.refresh()
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>登记测序交付</DialogTitle>
          <DialogDescription>
            外包测序回数据后，贴上数据存储链接、上传厂商交付 excel，透传给生信取数分析。
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="dl-url">数据存储链接（科创云 / 阿里云 OSS 等）</FieldLabel>
            <Input
              id="dl-url"
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={storageUrl}
              onChange={(event) => setStorageUrl(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="dl-file">厂商交付文件（excel / 邮件，可选存证）</FieldLabel>
            <Input
              id="dl-file"
              type="file"
              accept=".xlsx,.xls,.csv,.pdf,.eml,.msg,.zip"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="dl-note">备注（可选）</FieldLabel>
            <Textarea
              id="dl-note"
              rows={2}
              placeholder="如交付批次、覆盖样本、厂商说明等"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          <p className="text-xs text-muted-foreground">链接与文件至少填一项。</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            取消
          </Button>
          <Button onClick={onSubmit} disabled={busy || !canSubmit}>
            {busy ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden="true" />
            ) : (
              <Upload data-icon="inline-start" aria-hidden="true" />
            )}
            {busy ? "登记中…" : "登记并通知生信"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
