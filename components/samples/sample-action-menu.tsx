"use client"

import { MoreHorizontal } from "lucide-react"
import Link from "next/link"
import * as React from "react"
import type {
  ProjectStatus as ProjectStatusValue,
  SampleBatchStatus as SampleBatchStatusValue,
} from "@/lib/enums"
import { ReasonDialog } from "@/components/detail/reason-dialog"
import { useEntityAction } from "@/components/detail/use-entity-action"
import {
  partitionSampleActions,
  type SampleActionDescriptor,
} from "@/components/samples/sample-action-config"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type SampleActionMenuProps = {
  sampleId: string
  sampleNo: string
  status: SampleBatchStatusValue
  projectStatus?: ProjectStatusValue
  role?: string
  /** 列表行紧凑模式：sm outline 主按钮 + icon 溢出 */
  compact?: boolean
  /** 无可用动作时显示提示文案（工作项面板用），否则渲染 null */
  showEmptyHint?: boolean
  /** 主工作项动作入口。登记接收等主任务只打开 WorkItemPanel，不在本组件内弹表单。 */
  workItemHref?: string
}

/** 样本动作菜单：主动作按钮 + 溢出菜单；主任务入口统一进入 WorkItemPanel。 */
export function SampleActionMenu({
  sampleId,
  sampleNo,
  status,
  projectStatus,
  role,
  compact = false,
  showEmptyHint = false,
  workItemHref,
}: SampleActionMenuProps) {
  const { primary, overflow } = partitionSampleActions(status, role, projectStatus)
  const { run, isPending } = useEntityAction()
  // Dialog 受控挂在 DropdownMenuContent 之外，菜单关闭不连坐
  const [active, setActive] = React.useState<SampleActionDescriptor | null>(null)

  if (!primary && overflow.length === 0) {
    return showEmptyHint ? (
      <p className="text-sm text-muted-foreground">当前状态暂无可执行样本动作。</p>
    ) : null
  }

  function execute(descriptor: SampleActionDescriptor, body?: Record<string, unknown>) {
    run(`/api/samples/${sampleId}/${descriptor.path}`, descriptor.label, body, () =>
      setActive(null)
    )
  }

  function renderPrimary(descriptor: SampleActionDescriptor) {
    const Icon = descriptor.icon
    if (descriptor.kind === "workItem") {
      if (!workItemHref) return null
      return (
        <Button
          size={compact ? "sm" : "default"}
          variant={compact ? "outline" : "default"}
          disabled={isPending}
          asChild
        >
          <Link href={workItemHref} scroll={false}>
            <Icon data-icon="inline-start" aria-hidden="true" />
            {descriptor.label}
          </Link>
        </Button>
      )
    }

    return (
      <Button
        size={compact ? "sm" : "default"}
        variant={compact ? "outline" : "default"}
        disabled={isPending}
        onClick={() => setActive(descriptor)}
      >
        <Icon data-icon="inline-start" aria-hidden="true" />
        {descriptor.label}
      </Button>
    )
  }

  return (
    <div className={compact ? "flex items-center justify-end gap-1.5" : "flex items-center gap-2"}>
      {primary && renderPrimary(primary)}
      {overflow.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size={compact ? "icon-sm" : "icon"}
              aria-label={`样本 ${sampleNo} 更多动作`}
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
                    onSelect={() => setActive(descriptor)}
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

      <ReasonDialog
        open={active?.kind === "reasonDialog"}
        onOpenChange={(next) => !next && setActive(null)}
        title={active?.label ?? ""}
        description={active?.description}
        reasonLabel={active?.reasonLabel}
        required={active?.reasonRequired}
        destructive={active?.destructive}
        isPending={isPending}
        onConfirm={(reason) => active && execute(active, { reason })}
      />
    </div>
  )
}
