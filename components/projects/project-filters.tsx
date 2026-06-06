"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import {
  PROJECT_STATUS_LABELS,
  ProjectStatus,
  SERVICE_LEVEL_LABELS,
  ServiceLevel,
} from "@/lib/enums"
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

type ProjectFiltersProps = {
  initial: {
    q?: string
    status?: string
    serviceLevel?: string
  }
}

const ALL = "__all__"

export function ProjectFilters({ initial }: ProjectFiltersProps) {
  const router = useRouter()
  const [status, setStatus] = React.useState(initial.status || ALL)
  const [serviceLevel, setServiceLevel] = React.useState(initial.serviceLevel || ALL)

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const params = new URLSearchParams()
    const q = String(formData.get("q") || "").trim()
    if (q) params.set("q", q)
    if (status !== ALL) params.set("status", status)
    if (serviceLevel !== ALL) params.set("serviceLevel", serviceLevel)
    router.push(params.size ? `/projects?${params.toString()}` : "/projects")
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto]">
      <Input
        name="q"
        defaultValue={initial.q}
        placeholder="搜索项目编号 / 合同 / 客户…"
        spellCheck={false}
      />
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="项目状态" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value={ALL}>全部状态</SelectItem>
            {Object.values(ProjectStatus).map((value) => (
              <SelectItem key={value} value={value}>
                {PROJECT_STATUS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select value={serviceLevel} onValueChange={setServiceLevel}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="服务档次" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value={ALL}>全部档次</SelectItem>
            {Object.values(ServiceLevel).map((value) => (
              <SelectItem key={value} value={value}>
                {SERVICE_LEVEL_LABELS[value]}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Button type="submit">筛选</Button>
        <Button type="button" variant="outline" onClick={() => router.push("/projects")}>
          重置
        </Button>
      </div>
    </form>
  )
}
