"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { LoaderCircle, LogIn } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import { loginSchema } from "@/lib/schemas/auth"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // 默认落到根路由，由 app/page 按角色解析到对应工位（landingPathForRole）
  const callbackUrl = searchParams.get("callbackUrl") || "/"
  const [error, setError] = React.useState<string | null>(null)
  const [errorTarget, setErrorTarget] = React.useState<"account" | "password" | null>(null)
  const [isPending, startTransition] = React.useTransition()
  const accountRef = React.useRef<HTMLInputElement>(null)
  const passwordRef = React.useRef<HTMLInputElement>(null)

  function focusField(target: "account" | "password") {
    requestAnimationFrame(() => {
      const input = target === "account" ? accountRef.current : passwordRef.current
      input?.focus()
    })
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setErrorTarget(null)

    const formData = new FormData(event.currentTarget)
    const parsed = loginSchema.safeParse({
      account: formData.get("account"),
      password: formData.get("password"),
    })

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      const target = firstIssue?.path[0] === "password" ? "password" : "account"
      setErrorTarget(target)
      setError(firstIssue?.message ?? "请检查登录信息")
      focusField(target)
      return
    }

    startTransition(async () => {
      const result = await signIn("credentials", {
        account: parsed.data.account,
        password: parsed.data.password,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        const message =
          result.error === "CredentialsSignin"
            ? "账号或密码错误"
            : "登录失败，请稍后重试"
        setErrorTarget("password")
        setError(message)
        focusField("password")
        toast.error(message)
        return
      }

      router.push(result?.url || callbackUrl)
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="account">账号</FieldLabel>
          <Input
            ref={accountRef}
            id="account"
            name="account"
            autoComplete="username"
            placeholder="用户名 / 邮箱 / 手机号…"
            spellCheck={false}
            disabled={isPending}
            aria-invalid={errorTarget === "account"}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">密码</FieldLabel>
          <Input
            ref={passwordRef}
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            disabled={isPending}
            aria-invalid={errorTarget === "password"}
          />
          <FieldDescription>初始演示账号密码为 password123。</FieldDescription>
        </Field>
        {error && <FieldError aria-live="polite">{error}</FieldError>}
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
          ) : (
            <LogIn data-icon="inline-start" />
          )}
          登录
        </Button>
      </FieldGroup>
    </form>
  )
}
