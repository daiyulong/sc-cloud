import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { AppSidebar } from "@/components/app-sidebar"
import { UserMenu } from "@/components/user-menu"
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

  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
      >
        跳到主要内容
      </a>
      <AppSidebar user={session.user} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-6" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">单细胞云平台</span>
            <span className="truncate text-xs text-muted-foreground">
              项目管理与交付跟踪
            </span>
          </div>
          <UserMenu user={session.user} />
        </header>
        <main id="main-content" className="flex min-h-[calc(100svh-3.5rem)] flex-col">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
