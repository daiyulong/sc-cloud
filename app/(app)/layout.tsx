import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getWorkstationBadges } from "@/lib/workstation/badges"
import type { UserRole as UserRoleValue } from "@/lib/enums"
import { AppSidebar } from "@/components/app-sidebar"
import { PageTitle } from "@/components/page-title"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

export default async function AppLayout({
  children,
  sheet,
}: Readonly<{
  children: React.ReactNode
  /** @sheet 平行路由：详情软导航的侧滑层 */
  sheet: React.ReactNode
}>) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const badges = await getWorkstationBadges({
    id: session.user.id,
    role: session.user.role as UserRoleValue | undefined,
  })

  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
      >
        跳到主要内容
      </a>
      <AppSidebar user={session.user} badges={badges} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="!h-6" />
          <PageTitle />
        </header>
        <main id="main-content" className="flex min-h-[calc(100svh-3.5rem)] flex-col">
          {children}
        </main>
        {sheet}
      </SidebarInset>
    </SidebarProvider>
  )
}
