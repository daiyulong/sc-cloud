"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { SAMPLE_STATUS_LABELS, SampleStatus } from "@/lib/enums"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type SampleFiltersProps = {
  initial: {
    q?: string
    status?: string
    projectId?: string
  }
}

const ALL = "__all__"

export function SampleFilters({ initial }: SampleFiltersProps) {
  const router = useRouter()
  const [status, setStatus] = React.useState(initial.status || ALL)

  function buildHref(params: URLSearchParams) {
    // 保留项目维度筛选（从项目详情跳转而来）
    if (initial.projectId) params.set("projectId", initial.projectId)
    return params.size ? `/samples?${params.toString()}` : "/samples"
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const params = new URLSearchParams()
    const q = String(formData.get("q") || "").trim()
    if (q) params.set("q", q)
    if (status !== ALL) params.set("status", status)
    router.push(buildHref(params))
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
      <Input
        name="q"
        defaultValue={initial.q}
        placeholder="搜索样品编号 / 物种 / 组织 / 项目编号…"
        spellCheck={false}
      />
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="样本状态" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value={ALL}>全部状态</SelectItem>
            {Object.values(SampleStatus).map((value) => (
              <SelectItem key={value} value={value}>
                {SAMPLE_STATUS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Button type="submit">筛选</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(buildHref(new URLSearchParams()))}
        >
          重置
        </Button>
      </div>
    </form>
  )
}
