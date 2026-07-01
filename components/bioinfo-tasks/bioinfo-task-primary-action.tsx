"use client"

import { PlayCircle, Send } from "lucide-react"
import * as React from "react"
import {
  BioinfoTaskStatus,
  type BioinfoTaskStatus as BioinfoTaskStatusValue,
} from "@/lib/enums"
import { useEntityAction } from "@/components/detail/use-entity-action"
import { Button } from "@/components/ui/button"
import { SubmitDialog, type SubmitBioinfoBody } from "./submit-dialog"

type BioinfoTaskPrimaryActionProps = {
  taskId: string
  taskNo: string
  status: BioinfoTaskStatusValue
  analysisType: string | null
}

/**
 * 生信任务主动作：按状态切换主动作入口。
 * pending → 直接调 start API；in_progress / waiting_review → 打开提交报告 Dialog。
 * 其余状态（waiting_delivery / delivered / abnormal）不入主动作区。
 */
export function BioinfoTaskPrimaryAction({
  taskId,
  taskNo,
  status,
  analysisType,
}: BioinfoTaskPrimaryActionProps) {
  const { run, isPending } = useEntityAction()
  const [submitOpen, setSubmitOpen] = React.useState(false)

  if (status === BioinfoTaskStatus.pending) {
    return (
      <section className="rounded-md bg-muted/30 p-4">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <PlayCircle aria-hidden="true" />
              开始分析
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {taskNo} · 进入分析后可提交报告，提交审核为可选中间步。
            </p>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={isPending}
              onClick={() =>
                run(`/api/bioinfo-tasks/${taskId}/start`, "开始分析")
              }
            >
              <PlayCircle data-icon="inline-start" aria-hidden="true" />
              开始分析
            </Button>
          </div>
        </div>
      </section>
    )
  }

  if (
    status === BioinfoTaskStatus.in_progress ||
    status === BioinfoTaskStatus.waiting_review
  ) {
    const label =
      status === BioinfoTaskStatus.in_progress ? "提交报告" : "补交报告"
    return (
      <section className="rounded-md bg-muted/30 p-4">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <Send aria-hidden="true" />
              {label}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {taskNo} · 提交后进入待交付，由项目经理确认交付。
            </p>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={isPending}
              onClick={() => setSubmitOpen(true)}
            >
              <Send data-icon="inline-start" aria-hidden="true" />
              {label}
            </Button>
          </div>
        </div>
        <SubmitDialog
          open={submitOpen}
          onOpenChange={setSubmitOpen}
          taskNo={taskNo}
          defaultAnalysisType={analysisType}
          isPending={isPending}
          onConfirm={(body: SubmitBioinfoBody) =>
            run(`/api/bioinfo-tasks/${taskId}/submit`, label, body, () =>
              setSubmitOpen(false),
            )
          }
        />
      </section>
    )
  }

  return null
}
