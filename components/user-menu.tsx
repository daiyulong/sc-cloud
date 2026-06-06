"use client"

import { signOut } from "next-auth/react"
import type { Session } from "next-auth"
import { LogOut, UserCircle } from "lucide-react"
import { USER_ROLE_LABELS, type UserRole } from "@/lib/enums"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type UserMenuProps = {
  user: Session["user"]
}

function getInitial(name?: string | null, email?: string | null) {
  const source = name || email || "U"
  return source.slice(0, 1).toUpperCase()
}

export function UserMenu({ user }: UserMenuProps) {
  const role = user.role as UserRole | undefined

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 gap-2 px-2" aria-label="打开用户菜单">
          <Avatar size="sm">
            <AvatarFallback>{getInitial(user.name, user.email)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm md:inline">
            {user.name ?? user.email}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="truncate">{user.name ?? "当前用户"}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {role ? USER_ROLE_LABELS[role] : "未设置角色"}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem disabled>
            <UserCircle aria-hidden="true" />
            个人资料
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
  )
}
