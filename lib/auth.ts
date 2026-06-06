import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { authConfig } from "./auth.config"
import { checkRateLimit } from "@/lib/rate-limit"

// 登录速率限制：每账号每分钟最多 5 次
const LOGIN_RATE_LIMIT = 5
const LOGIN_RATE_WINDOW = 60 * 1000

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  // 第一期 Credentials+JWT，adapter 不实际写库；保留以备 OAuth/DB session（规格 §9.1）
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        account: { label: "账号", type: "text" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.account || !credentials?.password) {
          return null
        }

        const account = (credentials.account as string).trim()

        // 按账号限流，防暴力破解
        const { success } = checkRateLimit(`login:${account}`, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW)
        if (!success) {
          throw new Error("登录尝试过于频繁，请稍后再试")
        }

        // 用户名 / 邮箱 / 手机号均可登录
        const user = await prisma.user.findFirst({
          where: {
            OR: [{ username: account }, { email: account }, { phone: account }],
          },
        })

        if (!user || !user.password) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(credentials.password as string, user.password)
        if (!isPasswordValid) {
          return null
        }

        if (!user.isActive) {
          return null
        }

        // 异步更新最后登录时间，不阻塞登录
        void prisma.user
          .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
          .catch(console.error)

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
  ],
})
