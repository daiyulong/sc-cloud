"use client"

import { USER_ROLE_LABELS, type UserRole as UserRoleValue } from "@/lib/enums"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"

export type UserCellUser = {
  name: string
  role: string
  email?: string | null
  phone?: string | null
  department?: string | null
}

function getInitial(name: string) {
  return name.slice(0, 1).toUpperCase()
}

/** 人员单元格：头像 + 姓名，悬停/聚焦显示角色与联系方式卡片 */
export function UserCell({ user }: { user?: UserCellUser | null }) {
  if (!user) return <span className="text-muted-foreground">-</span>

  return (
    <HoverCard openDelay={300}>
      <HoverCardTrigger asChild>
        <span tabIndex={0} className="inline-flex items-center gap-1.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar size="sm">
            <AvatarFallback>{getInitial(user.name)}</AvatarFallback>
          </Avatar>
          {user.name}
        </span>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-64">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>{getInitial(user.name)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{user.name}</span>
              <span className="text-xs text-muted-foreground">
                {USER_ROLE_LABELS[user.role as UserRoleValue]}
                {user.department ? ` · ${user.department}` : ""}
              </span>
            </div>
          </div>
          {(user.email || user.phone) && (
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              {user.email && <span className="truncate">{user.email}</span>}
              {user.phone && <span>{user.phone}</span>}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
