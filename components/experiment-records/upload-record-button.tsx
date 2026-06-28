"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { LoaderCircle, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  RecordAlignmentDialog,
  type AlignmentData,
} from "@/components/experiment-records/record-alignment-dialog"

/** 上传前下采样（长边 ~1600px、压 JPEG）降体积与识别 token；失败回退原图 */
async function downsample(file: File): Promise<{ blob: Blob; name: string }> {
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    const w = Math.round(bmp.width * scale)
    const h = Math.round(bmp.height * scale)
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85))
    if (blob) return { blob, name: "record.jpg" }
  } catch {
    // 回退原图
  }
  return { blob: file, name: file.name }
}

/**
 * 上传实验记录照片 → 内联多模态识别 → 开对齐 Dialog（重构 §6）。
 * 仅按钮 + 流程；可见性由调用方用 canUploadRecord 决定（见 permissions）。
 */
export function UploadRecordButton({ taskId }: { taskId: string }) {
  const router = useRouter()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const [data, setData] = React.useState<AlignmentData | null>(null)
  const [open, setOpen] = React.useState(false)

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setBusy(true)
    try {
      const { blob, name } = await downsample(file)
      const form = new FormData()
      form.append("file", blob, name)
      const res = await fetch(`/api/experiment-tasks/${taskId}/record-images`, {
        method: "POST",
        body: form,
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "上传失败")
        return
      }
      setData(json.data as AlignmentData)
      setOpen(true)
      if (json.data.image.ocrStatus === "failed") toast.warning("识别未成功，可手工录入质控")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function closeDialog(next: boolean) {
    setOpen(next)
    if (!next) {
      setData(null)
      router.refresh()
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      <Button variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? (
          <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden="true" />
        ) : (
          <Upload data-icon="inline-start" aria-hidden="true" />
        )}
        {busy ? "识别中…" : "上传实验记录"}
      </Button>
      {data && (
        <RecordAlignmentDialog
          open={open}
          onOpenChange={closeDialog}
          data={data}
          onConfirmed={() => closeDialog(false)}
        />
      )}
    </>
  )
}
