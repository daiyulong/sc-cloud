"use client"

import { MoreHorizontal } from "lucide-react"
import Link from "next/link"
import type { ExperimentTaskStatus as ExperimentTaskStatusValue } from "@/lib/enums"
import {
  partitionExperimentTaskActions,
} from "@/components/experiment-tasks/experiment-task-action-config"
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
  /** 列表行紧凑模式：sm outline 主按钮 + icon 溢出 */
  compact?: boolean
  /** 无可用动作时显示提示文案（工作项面板用），否则渲染 null */
  showEmptyHint?: boolean
  /** 主工作项动作入口。实验推进动作只打开 WorkItemPanel，不在列表行弹表单。 */
  workItemHref?: string
}

/** 实验任务动作菜单：主动作进入 WorkItemPanel；补充动作在面板内分区处理。 */
export function ExperimentTaskActionMenu({
  taskNo,
  status,
  role,
  compact = false,
  showEmptyHint = false,
  workItemHref,
}: ExperimentTaskActionMenuProps) {
  const { primary, overflow } = partitionExperimentTaskActions(status, role)

  if (!primary && overflow.length === 0) {
    return showEmptyHint ? (
      <p className="text-sm text-muted-foreground">当前状态暂无可执行实验任务动作。</p>
    ) : null
  }

  const primaryHref = primary ? workItemHref : undefined
  if (primary && !primaryHref) {
    return showEmptyHint ? (
      <p className="text-sm text-muted-foreground">请从列表打开工作项后继续处理。</p>
    ) : null
  }

  return (
    <div className={compact ? "flex items-center justify-end gap-1.5" : "flex items-center gap-2"}>
      {primary && primaryHref && (
        <Button
          size={compact ? "sm" : "default"}
          variant={compact ? "outline" : "default"}
          asChild
        >
          <Link href={primaryHref} scroll={false}>
            <primary.icon data-icon="inline-start" aria-hidden="true" />
            {primary.label}
          </Link>
        </Button>
      )}
      {!primary && overflow.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size={compact ? "icon-sm" : "icon"}
              aria-label={`任务 ${taskNo} 更多动作`}
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
                    disabled
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
    </div>
  )
}
