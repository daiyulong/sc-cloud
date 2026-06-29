import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getWorkstationBadges } from "@/lib/workstation/badges"
import type { UserRole as UserRoleValue } from "@/lib/enums"
import { AppSidebar } from "@/components/app-sidebar"
import { DetailBreadcrumbProvider, HeaderTitle } from "@/components/header-breadcrumb"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
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
      <DetailBreadcrumbProvider>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="!h-6" />
          <HeaderTitle />
        </header>
        <main id="main-content" className="flex min-h-[calc(100svh-3.5rem)] flex-col">
          {children}
        </main>
      </SidebarInset>
      </DetailBreadcrumbProvider>
    </SidebarProvider>
  )
}
