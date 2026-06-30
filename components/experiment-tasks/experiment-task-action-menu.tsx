"use client"

import { MoreHorizontal } from "lucide-react"
import * as React from "react"
import type { ExperimentTaskStatus as ExperimentTaskStatusValue } from "@/lib/enums"
import type { ActionSurface } from "@/components/detail/action-overlay"
import { useEntityAction } from "@/components/detail/use-entity-action"
import {
  partitionExperimentTaskActions,
  type ExperimentTaskActionDescriptor,
} from "@/components/experiment-tasks/experiment-task-action-config"
import {
  ScheduleDialog,
  type OperatorOption,
  type ScheduleTaskBody,
} from "@/components/experiment-tasks/schedule-dialog"
import {
  FeedbackDialog,
  type FeedbackAnalystOption,
  type FeedbackTaskBody,
} from "@/components/experiment-tasks/feedback-dialog"
import { QcDialog, type QcRecordBody } from "@/components/experiment-tasks/qc-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type ExperimentTaskActionMenuProps = {
  taskId: string
  taskNo: string
  status: ExperimentTaskStatusValue
  role?: string
  operatorOptions: OperatorOption[]
  bioinfoEnabled?: boolean
  analystOptions?: FeedbackAnalystOption[]
  /** 列表行紧凑模式：sm outline 主按钮 + icon 溢出 */
  compact?: boolean
  /** 无可用动作时显示提示文案（sheet/全页用），否则渲染 null */
  showEmptyHint?: boolean
  /** 排期/反馈/质控浮层落点：列表行传 "sheet"（右抽屉），详情侧滑/全页用默认 "dialog" 避免双右浮层 */
  surface?: ActionSurface
}

/** 实验任务动作菜单：主动作按钮 + 溢出菜单 + 表单浮层，列表行 / 侧滑 / 全页三处共用 */
export function ExperimentTaskActionMenu({
  taskId,
  taskNo,
  status,
  role,
  operatorOptions,
  bioinfoEnabled = false,
  analystOptions = [],
  compact = false,
  showEmptyHint = false,
  surface,
}: ExperimentTaskActionMenuProps) {
  const { primary, overflow } = partitionExperimentTaskActions(status, role)
  const { run, isPending } = useEntityAction()
  // Dialog 受控挂在 DropdownMenuContent 之外，菜单关闭不连坐
  const [active, setActive] = React.useState<ExperimentTaskActionDescriptor | null>(null)

  if (!primary && overflow.length === 0) {
    return showEmptyHint ? (
      <p className="text-sm text-muted-foreground">当前状态暂无可执行实验任务动作。</p>
    ) : null
  }

  function execute(descriptor: ExperimentTaskActionDescriptor, body?: Record<string, unknown>) {
    run(`/api/experiment-tasks/${taskId}/${descriptor.path}`, descriptor.label, body, () =>
      setActive(null)
    )
  }

  function handleSelect(descriptor: ExperimentTaskActionDescriptor) {
    if (descriptor.kind === "direct") execute(descriptor)
    else setActive(descriptor)
  }

  return (
    <div className={compact ? "flex items-center justify-end gap-1.5" : "flex items-center gap-2"}>
      {primary && (
        <Button
          size={compact ? "sm" : "default"}
          variant={compact ? "outline" : "default"}
          disabled={isPending}
          onClick={() => handleSelect(primary)}
        >
          <primary.icon data-icon="inline-start" aria-hidden="true" />
          {primary.label}
        </Button>
      )}
      {overflow.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size={compact ? "icon-sm" : "icon"}
              aria-label={`任务 ${taskNo} 更多动作`}
              disabled={isPending}
            >
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              {overflow.map((descriptor) => {
                const Icon = descriptor.icon
                return (
                  <DropdownMenuItem
                    key={descriptor.action}
                    onSelect={() => handleSelect(descriptor)}
                  >
                    <Icon aria-hidden="true" />
                    {descriptor.label}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <ScheduleDialog
        open={active?.kind === "scheduleDialog"}
        onOpenChange={(next) => !next && setActive(null)}
        taskNo={taskNo}
        operatorOptions={operatorOptions}
        isPending={isPending}
        surface={surface}
        onConfirm={(body: ScheduleTaskBody) => active && execute(active, body)}
      />
      <FeedbackDialog
        open={active?.kind === "feedbackDialog"}
        onOpenChange={(next) => !next && setActive(null)}
        taskNo={taskNo}
        isPending={isPending}
        surface={surface}
        bioinfoEnabled={bioinfoEnabled}
        analystOptions={analystOptions}
        onConfirm={(body: FeedbackTaskBody) => active && execute(active, body)}
      />
      <QcDialog
        open={active?.kind === "qcDialog"}
        onOpenChange={(next) => !next && setActive(null)}
        taskNo={taskNo}
        isPending={isPending}
        surface={surface}
        onConfirm={(body: QcRecordBody) => active && execute(active, body)}
      />
    </div>
  )
}
