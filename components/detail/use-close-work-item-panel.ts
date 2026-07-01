"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

/**
 * 关闭工作项面板的统一收尾：从当前 URL 移除指定查询参数，保留其余筛选/状态，
 * 与 `WorkItemPanel` 的关闭契约一致（关闭不后退、保留其他 query）。
 */
export function useCloseWorkItemPanel(param = "view") {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return function close() {
    const sp = new URLSearchParams(searchParams)
    sp.delete(param)
    const qs = sp.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }
}
