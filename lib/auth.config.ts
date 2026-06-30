import type { NextAuthConfig } from "next-auth"
import type { UserRole } from "@/lib/enums"
import "next-auth/jwt"

// 该配置用于 proxy.ts（Edge Runtime），不能引用 Prisma
export const authConfig: NextAuthConfig = {
  // 信任反向代理传递的 host（生产部署在代理后）
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [], // 实际 providers 在 auth.ts 配置
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const publicPaths = ["/login", "/api/auth", "/api/health"]
      const isPublicPath = publicPaths.some(
        (path) => nextUrl.pathname === path || nextUrl.pathname.startsWith(path + "/")
      )

      if (isPublicPath) {
        // 登录页由 Server Component 做数据库态校验后跳转，避免停用账号的过期 JWT 形成重定向循环。
        return true
      }

      // 未登录访问受保护页面 → 跳登录页并带 callbackUrl
      if (!isLoggedIn) {
        const loginUrl = new URL("/login", nextUrl)
        loginUrl.searchParams.set("callbackUrl", nextUrl.pathname)
        return Response.redirect(loginUrl)
      }

      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: UserRole }).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
      }
      return session
    },
  },
}

// 扩展 NextAuth 类型，注入业务 id/role
declare module "next-auth" {
  interface User {
    role?: UserRole
  }
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      role?: UserRole
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: UserRole
  }
}
