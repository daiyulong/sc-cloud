"use client"

import { MoreHorizontal } from "lucide-react"
import * as React from "react"
import type { BioinfoTaskStatus as BioinfoTaskStatusValue } from "@/lib/enums"
import { useEntityAction } from "@/components/detail/use-entity-action"
import {
  partitionBioinfoTaskActions,
  type BioinfoTaskActionDescriptor,
} from "@/components/bioinfo-tasks/bioinfo-task-action-config"
import { SubmitDialog, type SubmitBioinfoBody } from "@/components/bioinfo-tasks/submit-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type BioinfoTaskActionMenuProps = {
  taskId: string
  taskNo: string
  status: BioinfoTaskStatusValue
  role?: string
  /** 提交报告 Dialog 的分析类型预填 */
  analysisType?: string | null
  /** 列表行紧凑模式：sm outline 主按钮 + icon 溢出 */
  compact?: boolean
  /** 无可用动作时显示提示文案（工作项面板 / 全页用），否则渲染 null */
  showEmptyHint?: boolean
}

/** 生信任务动作菜单：主动作按钮 + 溢出菜单 + 提交表单 Dialog，列表行 / 工作项面板 / 全页三处共用 */
export function BioinfoTaskActionMenu({
  taskId,
  taskNo,
  status,
  role,
  analysisType,
  compact = false,
  showEmptyHint = false,
}: BioinfoTaskActionMenuProps) {
  const { primary, overflow } = partitionBioinfoTaskActions(status, role)
  const { run, isPending } = useEntityAction()
  // Dialog 受控挂在 DropdownMenuContent 之外，菜单关闭不连坐
  const [active, setActive] = React.useState<BioinfoTaskActionDescriptor | null>(null)

  if (!primary && overflow.length === 0) {
    return showEmptyHint ? (
      <p className="text-sm text-muted-foreground">当前状态暂无可执行生信任务动作。</p>
    ) : null
  }

  function execute(descriptor: BioinfoTaskActionDescriptor, body?: Record<string, unknown>) {
    run(`/api/bioinfo-tasks/${taskId}/${descriptor.path}`, descriptor.label, body, () =>
      setActive(null)
    )
  }

  function handleSelect(descriptor: BioinfoTaskActionDescriptor) {
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

      <SubmitDialog
        open={active?.kind === "submitDialog"}
        onOpenChange={(next) => !next && setActive(null)}
        taskNo={taskNo}
        defaultAnalysisType={analysisType}
        isPending={isPending}
        onConfirm={(body: SubmitBioinfoBody) => active && execute(active, body)}
      />
    </div>
  )
}
