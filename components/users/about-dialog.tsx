"use client"

import { Info } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type AboutDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0"
const commit = process.env.NEXT_PUBLIC_BUILD_COMMIT ?? "unknown"

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="size-5" aria-hidden="true" />
            关于
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-4 pt-2 text-sm text-muted-foreground">
              <div className="space-y-1.5">
                <p className="font-semibold text-foreground">单细胞云平台</p>
                <p>面向单细胞实验服务业务的项目管理与交付跟踪平台，覆盖「销售建项目 → 项目经理确认 → 收样 → 实验+质控 → 生信分析 → 交付关闭」全链路。</p>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                <span className="text-muted-foreground/70">版本</span>
                <span className="font-mono tabular-nums">{version}</span>
                <span className="text-muted-foreground/70">构建</span>
                <span className="font-mono tabular-nums">{commit}</span>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
