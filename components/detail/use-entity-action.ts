"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"

/**
 * 实体动作执行：POST 语义化动作 API + toast + router.refresh。
 * 成功时调用 onSuccess（关 Dialog 等），失败 toast 错误并保持现场。
 */
export function useEntityAction() {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()

  const run = React.useCallback(
    (url: string, label: string, body?: Record<string, unknown>, onSuccess?: () => void) => {
      startTransition(async () => {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body ?? {}),
        })
        const result = await response.json().catch(() => null)
        if (!response.ok) {
          toast.error(result?.error || `${label}失败`)
          return
        }
        toast.success(`${label}成功`)
        onSuccess?.()
        router.refresh()
      })
    },
    [router]
  )

  return { run, isPending }
}
