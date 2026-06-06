import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { LoginForm } from "./login-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const dynamic = "force-dynamic"

export default async function LoginPage() {
  const session = await auth()
  if (session?.user?.id) {
    redirect("/dashboard")
  }

  return (
    <main className="grid min-h-svh items-start bg-muted/30 px-4 py-6 sm:py-10 lg:place-items-center">
      <div className="grid w-full max-w-5xl gap-5 sm:gap-6 lg:grid-cols-[1fr_420px] lg:items-center">
        <section className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-md bg-primary text-base font-semibold text-primary-foreground">
              SC
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="text-sm text-muted-foreground">sc-cloud</span>
              <h1 className="text-pretty text-3xl font-semibold tracking-normal">
                单细胞云平台
              </h1>
            </div>
          </div>
          <p className="max-w-xl text-pretty text-sm leading-6 text-muted-foreground">
            项目流转、样本接收、实验排期、质控反馈、生信分析和交付关闭。
          </p>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>登录系统</CardTitle>
            <CardDescription>使用平台账号进入工作台</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
