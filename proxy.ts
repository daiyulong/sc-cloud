// Next.js 16 用 proxy.ts（middleware 的继任命名）承载边缘鉴权。
// Edge Runtime 只加载无 Prisma 的 authConfig，完整 Credentials provider 在 lib/auth.ts。
import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"

const { auth } = NextAuth(authConfig)

export const proxy = auth

export const config = {
  // 排除静态资源与图片，其余路径都过 authorized 鉴权
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.svg|.*\\.ico).*)",
  ],
}
