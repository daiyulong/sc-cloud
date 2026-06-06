"use client"

import { Edit, KeyRound, MoreHorizontal, UserCheck, UserX } from "lucide-react"
import * as React from "react"
import { ConfirmDialog } from "@/components/detail/confirm-dialog"
import { useEntityAction } from "@/components/detail/use-entity-action"
import { UserFormDialog, type UserFormValue } from "@/components/users/user-form-dialog"
import { UserResetPasswordDialog } from "@/components/users/user-reset-password-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type UserActionMenuProps = {
  user: UserFormValue & { isActive: boolean }
  /** 当前登录用户 id：自己的行不提供停用入口 */
  selfId: string
}

type ActiveDialog = "edit" | "resetPassword" | "toggle" | null

/** 用户行内动作：编辑主按钮 + 溢出菜单（重置密码 / 启用 / 停用） */
export function UserActionMenu({ user, selfId }: UserActionMenuProps) {
  const { run, isPending } = useEntityAction()
  // Dialog 受控挂在 DropdownMenuContent 之外，菜单关闭不连坐
  const [active, setActive] = React.useState<ActiveDialog>(null)

  const isSelf = user.id === selfId
  const toggleLabel = user.isActive ? "停用账号" : "启用账号"

  function toggle() {
    run(`/api/admin/users/${user.id}/toggle`, user.isActive ? "停用" : "启用", undefined, () =>
      setActive(null)
    )
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button size="sm" variant="outline" disabled={isPending} onClick={() => setActive("edit")}>
        <Edit data-icon="inline-start" aria-hidden="true" />
        编辑
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label={`${user.name} 更多操作`}>
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setActive("resetPassword")}>
            <KeyRound aria-hidden="true" />
            重置密码
          </DropdownMenuItem>
          {!isSelf &&
            (user.isActive ? (
              <DropdownMenuItem variant="destructive" onSelect={() => setActive("toggle")}>
                <UserX aria-hidden="true" />
                停用账号
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => setActive("toggle")}>
                <UserCheck aria-hidden="true" />
                启用账号
              </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <UserFormDialog
        open={active === "edit"}
        onOpenChange={(open) => setActive(open ? "edit" : null)}
        mode="edit"
        user={user}
        selfId={selfId}
      />
      <UserResetPasswordDialog
        open={active === "resetPassword"}
        onOpenChange={(open) => setActive(open ? "resetPassword" : null)}
        userId={user.id}
        userName={user.name}
      />
      <ConfirmDialog
        open={active === "toggle"}
        onOpenChange={(open) => setActive(open ? "toggle" : null)}
        title={toggleLabel}
        description={
          user.isActive
            ? `${user.name} 将无法登录系统，历史数据与负责关系保留。`
            : `${user.name} 将恢复登录权限。`
        }
        destructive={user.isActive}
        isPending={isPending}
        onConfirm={toggle}
      />
    </div>
  )
}
