"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type FormDialogProps = {
  title: string
  children: React.ReactNode
  /** 触发的查询参数名；关闭即从 URL 移除（默认 new） */
  param?: string
}

/**
 * 查询参数驱动的居中表单模态（叶子快速创建用，见 ADR-0002）。
 * 列表页在 `?<param>=1` 存在时渲染；关闭（X/ESC/遮罩）→ 删该参数回列表。
 * 用模态而非右抽屉：从列表快速建一条记录是主流模态范式（Linear/Airtable），
 * 且"创建"与"查看详情"是不同功能、无需共用同一种浮层。
 */
export function FormDialog({ title, children, param = "new" }: FormDialogProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = React.useState(true)

  function close() {
    setOpen(false)
    const sp = new URLSearchParams(searchParams)
    sp.delete(param)
    const qs = sp.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
