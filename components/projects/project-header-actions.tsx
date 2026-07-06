"use client"

import Link from "next/link"
import { Edit, MoreHorizontal } from "lucide-react"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type ProjectHeaderActionsProps = {
  projectId: string
  projectNo: string | null
  status: ProjectStatusValue
  role?: string
}

/**
 * 项目详情页头部动作：一个流程主按钮 + 一个统一更多菜单。
 * 详情页是 hub，维护类动作（编辑）和异常类流程动作不直接抢占 header。
 */
export function ProjectHeaderActions({
  projectId,
  projectNo,
  status,
  role,
}: ProjectHeaderActionsProps) {
  const { primary, overflow } = partitionProjectActions(status, role)
  const { run, isPending } = useEntityAction()
  const [active, setActive] = React.useState<ProjectActionDescriptor | null>(null)

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
    <div className="flex items-center gap-2">
      {primary && (
        <Button disabled={isPending} onClick={() => handleSelect(primary)}>
          <primary.icon data-icon="inline-start" aria-hidden="true" />
          {primary.label}
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label={`项目 ${projectNo ?? "未编号草稿"} 更多动作`}
            disabled={isPending}
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href={`/projects/${projectId}/edit`}>
                <Edit aria-hidden="true" />
                编辑项目
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          {overflow.length > 0 && (
            <>
              <DropdownMenuSeparator />
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
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

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
        description={active?.description}
        projectNoRequired={active?.action === "fillProjectNo"}
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
