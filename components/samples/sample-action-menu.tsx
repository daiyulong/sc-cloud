"use client"

import { MoreHorizontal } from "lucide-react"
import * as React from "react"
import type { SampleBatchStatus as SampleBatchStatusValue } from "@/lib/enums"
import { ReasonDialog } from "@/components/detail/reason-dialog"
import { useEntityAction } from "@/components/detail/use-entity-action"
import {
  partitionSampleActions,
  type SampleActionDescriptor,
} from "@/components/samples/sample-action-config"
import {
  SampleReceiveDialog,
  type ReceiveSampleBody,
} from "@/components/samples/sample-receive-dialog"
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
  role?: string
  /** 列表行紧凑模式：sm outline 主按钮 + icon 溢出 */
  compact?: boolean
  /** 无可用动作时显示提示文案（sheet/全页用），否则渲染 null */
  showEmptyHint?: boolean
}

/** 样本动作菜单：主动作按钮 + 溢出菜单 + Dialog，列表行 / 侧滑 / 全页三处共用 */
export function SampleActionMenu({
  sampleId,
  sampleNo,
  status,
  role,
  compact = false,
  showEmptyHint = false,
}: SampleActionMenuProps) {
  const { primary, overflow } = partitionSampleActions(status, role)
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

      <SampleReceiveDialog
        open={active?.kind === "formDialog"}
        onOpenChange={(next) => !next && setActive(null)}
        sampleNo={sampleNo}
        isPending={isPending}
        onConfirm={(body: ReceiveSampleBody) => active && execute(active, body)}
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
        onConfirm={(reason) => active && execute(active, { reason })}
      />
    </div>
  )
}
