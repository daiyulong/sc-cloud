"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { Session } from "next-auth"
import type { UserRole } from "@/lib/enums"
import { landingPathForRole } from "@/lib/auth/landing"
import type { WorkstationBadges } from "@/lib/workstation/badges"
import { adminNavItems, primaryNavItems, type NavItem } from "@/components/nav-items"
import { UserMenu } from "@/components/user-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"

type AppSidebarProps = {
  user: Session["user"]
  badges?: WorkstationBadges
}

function NavGroup({
  items,
  pathname,
  badges,
}: {
  items: NavItem[]
  pathname: string
  badges?: WorkstationBadges
}) {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            const count = item.key ? badges?.[item.key as keyof WorkstationBadges] : undefined
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                  <Link href={item.href} aria-current={isActive ? "page" : undefined}>
                    <item.icon aria-hidden="true" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
                {count ? (
                  <SidebarMenuBadge aria-label={`${count} 项待处理`}>{count}</SidebarMenuBadge>
                ) : null}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function AppSidebar({ user, badges }: AppSidebarProps) {
  const pathname = usePathname()
  const role = user.role as UserRole | undefined
  const isAdmin = role === "admin"

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href={landingPathForRole(role)}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
                  SC
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">单细胞云平台</span>
                  <span className="truncate text-xs text-sidebar-foreground/70">
                    项目交付闭环
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup items={primaryNavItems} pathname={pathname} badges={badges} />
        {isAdmin && (
          <>
            <SidebarSeparator />
            <NavGroup items={adminNavItems} pathname={pathname} />
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        <UserMenu user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
