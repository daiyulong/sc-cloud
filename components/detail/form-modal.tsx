"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type FormModalProps = {
  title: string
  description?: string
  children: React.ReactNode
}

/**
 * 拦截路由的居中表单模态（创建类聚焦任务用；条目查看用 DetailSheet）。
 * 关闭（ESC/遮罩/X）→ router.back() 回来源页。
 */
export function FormModal({ title, description, children }: FormModalProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(true)

  function onOpenChange(next: boolean) {
    if (!next) {
      setOpen(false)
      router.back()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
