"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookOpen,
  Dna,
  FlaskConical,
  FolderKanban,
  LayoutDashboard,
  Microscope,
  PackageCheck,
  Upload,
  Users,
} from "lucide-react"
import type { Session } from "next-auth"
import type { UserRole } from "@/lib/enums"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const primaryItems = [
  { title: "工作台", href: "/dashboard", icon: LayoutDashboard },
  { title: "项目", href: "/projects", icon: FolderKanban },
  { title: "样本接收", href: "/samples", icon: Microscope },
  { title: "实验排期", href: "/experiment-tasks", icon: FlaskConical },
  { title: "生信分析", href: "/bioinfo-tasks", icon: Dna },
  { title: "交付", href: "/delivery", icon: PackageCheck },
  { title: "经验库", href: "/experiences", icon: BookOpen },
]

const adminItems = [
  { title: "历史导入", href: "/imports", icon: Upload },
  { title: "用户管理", href: "/system/users", icon: Users },
]

type AppSidebarProps = {
  user: Session["user"]
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname()
  const role = user.role as UserRole | undefined
  const isAdmin = role === "admin"

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
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
        <SidebarGroup>
          <SidebarGroupLabel>业务</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {primaryItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                  >
                    <Link
                      href={item.href}
                      aria-current={
                        pathname === item.href || pathname.startsWith(`${item.href}/`)
                          ? "page"
                          : undefined
                      }
                    >
                      <item.icon aria-hidden="true" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>管理</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                    >
                      <Link
                        href={item.href}
                        aria-current={
                          pathname === item.href || pathname.startsWith(`${item.href}/`)
                            ? "page"
                            : undefined
                        }
                      >
                        <item.icon aria-hidden="true" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
