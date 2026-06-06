"use client"

import { signOut } from "next-auth/react"
import type { Session } from "next-auth"
import { ChevronsUpDown, KeyRound, LogOut } from "lucide-react"
import * as React from "react"
import { USER_ROLE_LABELS, type UserRole } from "@/lib/enums"
import { ChangePasswordDialog } from "@/components/users/change-password-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

type UserMenuProps = {
  user: Session["user"]
}

function getInitial(name?: string | null, email?: string | null) {
  const source = name || email || "U"
  return source.slice(0, 1).toUpperCase()
}

/** 侧边栏底部用户菜单（Vercel 式：头像 + 名称 + 角色，向上/向右弹出） */
export function UserMenu({ user }: UserMenuProps) {
  const role = user.role as UserRole | undefined
  const { isMobile } = useSidebar()
  // Dialog 受控挂在 DropdownMenuContent 之外，菜单关闭不连坐
  const [passwordOpen, setPasswordOpen] = React.useState(false)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              aria-label="打开用户菜单"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar size="sm">
                <AvatarFallback>{getInitial(user.name, user.email)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name ?? user.email}</span>
                <span className="truncate text-xs text-sidebar-foreground/70">
                  {role ? USER_ROLE_LABELS[role] : "未设置角色"}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" aria-hidden="true" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="flex flex-col gap-1">
              <span className="truncate">{user.name ?? "当前用户"}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">
                {role ? USER_ROLE_LABELS[role] : "未设置角色"}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>
                <KeyRound aria-hidden="true" />
                修改密码
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut aria-hidden="true" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
