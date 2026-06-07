"use client"

import { MoreHorizontal } from "lucide-react"
import * as React from "react"
import type { ProjectStatus as ProjectStatusValue } from "@/lib/enums"
import { ConfirmDialog } from "@/components/detail/confirm-dialog"
import { ReasonDialog } from "@/components/detail/reason-dialog"
import { useEntityAction } from "@/components/detail/use-entity-action"
import {
  partitionProjectActions,
  type ProjectActionDescriptor,
} from "@/components/projects/project-action-config"
import {
  ProjectConfirmDialog,
  type ConfirmProjectBody,
} from "@/components/projects/project-confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type ProjectActionMenuProps = {
  projectId: string
  projectNo: string | null
  status: ProjectStatusValue
  role?: string
  /** 列表行紧凑模式：sm outline 主按钮 + icon 溢出 */
  compact?: boolean
  /** 无可用动作时显示提示文案（sheet/全页用），否则渲染 null */
  showEmptyHint?: boolean
}

/** 项目动作菜单：主动作按钮 + 溢出菜单 + Dialog，列表行 / 侧滑 / 全页三处共用 */
export function ProjectActionMenu({
  projectId,
  projectNo,
  status,
  role,
  compact = false,
  showEmptyHint = false,
}: ProjectActionMenuProps) {
  const { primary, overflow } = partitionProjectActions(status, role)
  const { run, isPending } = useEntityAction()
  // Dialog 受控挂在 DropdownMenuContent 之外，菜单关闭不连坐
  const [active, setActive] = React.useState<ProjectActionDescriptor | null>(null)

  if (!primary && overflow.length === 0) {
    return showEmptyHint ? (
      <p className="text-sm text-muted-foreground">当前状态暂无可执行项目动作。</p>
    ) : null
  }

  function execute(descriptor: ProjectActionDescriptor, body?: Record<string, unknown>) {
    run(`/api/projects/${projectId}/${descriptor.path}`, descriptor.label, body, () =>
      setActive(null)
    )
  }

  function handleSelect(descriptor: ProjectActionDescriptor) {
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
              aria-label={`项目 ${projectNo ?? "未编号草稿"} 更多动作`}
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
                    variant={descriptor.destructive ? "destructive" : "default"}
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

      <ConfirmDialog
        open={active?.kind === "confirmDialog"}
        onOpenChange={(next) => !next && setActive(null)}
        title={active?.label ?? ""}
        description={active?.description}
        destructive={active?.destructive}
        isPending={isPending}
        onConfirm={() => active && execute(active)}
      />
      <ProjectConfirmDialog
        open={active?.kind === "confirmForm"}
        onOpenChange={(next) => !next && setActive(null)}
        isPending={isPending}
        onConfirm={(body: ConfirmProjectBody) => active && execute(active, body)}
      />
      <ReasonDialog
        open={active?.kind === "reasonDialog"}
        onOpenChange={(next) => !next && setActive(null)}
        title={active?.label ?? ""}
        description={active?.description}
        reasonLabel={active?.reasonLabel}
        required={active?.reasonRequired}
        destructive={active?.destructive}
        isPending={isPending}
        onConfirm={(reason) => active && execute(active, reason ? { reason } : {})}
      />
    </div>
  )
}
