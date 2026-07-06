"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type FillContractNoDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  /** 弹窗关闭后回调（可用来重试原操作） */
  onConfirmed?: () => void
}

export function FillContractNoDialog({
  open,
  onOpenChange,
  projectId,
  onConfirmed,
}: FillContractNoDialogProps) {
  const router = useRouter()
  const [contractNo, setContractNo] = React.useState("")
  const [projectNo, setProjectNo] = React.useState("")
  const [showError, setShowError] = React.useState(false)
  const [isPending, setIsPending] = React.useState(false)
  const [prevOpen, setPrevOpen] = React.useState(open)

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setContractNo("")
      setProjectNo("")
      setShowError(false)
    }
  }

  function handleConfirm() {
    const cTrim = contractNo.trim()
    const pTrim = projectNo.trim()
    if (!cTrim || !pTrim) {
      setShowError(true)
      return
    }
    setIsPending(true)
    fetch(`/api/projects/${projectId}/fill-project-no`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractNo: cTrim, projectNo: pTrim }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.data) throw new Error(data.error || "保存失败")
        toast.success("编号已保存")
        onOpenChange(false)
        onConfirmed?.()
        router.refresh()
      })
      .catch((err) => {
        toast.error(err.message || "保存失败")
      })
      .finally(() => setIsPending(false))
  }

  const contractInvalid = showError && !contractNo.trim()
  const projectInvalid = showError && !projectNo.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>补填合同编号与项目编号</DialogTitle>
          <DialogDescription>
            预约实验前需先填写合同编号与项目编号，填写后不可修改。
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field data-invalid={contractInvalid || undefined}>
            <FieldLabel htmlFor="fill-contract-no">合同编号</FieldLabel>
            <Input
              id="fill-contract-no"
              value={contractNo}
              onChange={(event) => setContractNo(event.target.value)}
              placeholder="请输入合同编号"
              aria-invalid={contractInvalid || undefined}
              autoComplete="off"
            />
            {contractInvalid && (
              <FieldDescription className="text-destructive">请输入合同编号。</FieldDescription>
            )}
          </Field>
          <Field data-invalid={projectInvalid || undefined}>
            <FieldLabel htmlFor="fill-project-no">项目编号（委托单号）</FieldLabel>
            <Input
              id="fill-project-no"
              value={projectNo}
              onChange={(event) => setProjectNo(event.target.value)}
              placeholder="如 BP-G260504587"
              aria-invalid={projectInvalid || undefined}
              autoComplete="off"
            />
            {projectInvalid && (
              <FieldDescription className="text-destructive">请输入项目编号（委托单号）。</FieldDescription>
            )}
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            确认
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
