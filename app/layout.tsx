import type { Metadata } from "next"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "单细胞云平台",
    template: "%s | 单细胞云平台",
  },
  description: "单细胞实验服务项目管理与交付跟踪平台",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-svh bg-background font-sans antialiased">
        {children}
        <Toaster richColors />
      </body>
    </html>
  )
}
