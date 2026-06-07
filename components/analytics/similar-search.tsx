"use client"

import { useRouter } from "next/navigation"
import { Search, X } from "lucide-react"
import * as React from "react"
import { SUSPENSION_TYPE_LABELS, SuspensionType } from "@/lib/enums"
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

const ANY = "__any__"

type SimilarSearchProps = {
  initial: {
    species?: string
    tissue?: string
    runMethod?: string
    suspensionType?: string
  }
}

/** 相似经验检索表单：按维度筛历史上机，提交即写 URL（searchParams 驱动服务端检索） */
export function SimilarSearch({ initial }: SimilarSearchProps) {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()
  const [species, setSpecies] = React.useState(initial.species ?? "")
  const [tissue, setTissue] = React.useState(initial.tissue ?? "")
  const [runMethod, setRunMethod] = React.useState(initial.runMethod ?? "")
  const [suspensionType, setSuspensionType] = React.useState(initial.suspensionType || ANY)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const params = new URLSearchParams()
    if (species.trim()) params.set("species", species.trim())
    if (tissue.trim()) params.set("tissue", tissue.trim())
    if (runMethod.trim()) params.set("runMethod", runMethod.trim())
    if (suspensionType !== ANY) params.set("suspensionType", suspensionType)
    const qs = params.toString()
    startTransition(() => router.push(qs ? `/experiences?${qs}` : "/experiences", { scroll: false }))
  }

  function clear() {
    setSpecies("")
    setTissue("")
    setRunMethod("")
    setSuspensionType(ANY)
    startTransition(() => router.push("/experiences", { scroll: false }))
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <Field label="物种">
        <Input value={species} onChange={(e) => setSpecies(e.target.value)} placeholder="人 / 小鼠…" className="w-36" />
      </Field>
      <Field label="组织">
        <Input value={tissue} onChange={(e) => setTissue(e.target.value)} placeholder="肺 / 肝…" className="w-36" />
      </Field>
      <Field label="建库化学">
        <Input value={runMethod} onChange={(e) => setRunMethod(e.target.value)} placeholder="10x 3' / 5'…" className="w-36" />
      </Field>
      <Field label="悬液类型">
        <Select value={suspensionType} onValueChange={setSuspensionType}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value={ANY}>全部</SelectItem>
              {Object.values(SuspensionType).map((v) => (
                <SelectItem key={v} value={v}>
                  {SUSPENSION_TYPE_LABELS[v]}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Button type="submit" disabled={isPending}>
        <Search data-icon="inline-start" aria-hidden="true" />
        检索
      </Button>
      <Button type="button" variant="ghost" onClick={clear} disabled={isPending}>
        <X data-icon="inline-start" aria-hidden="true" />
        清除
      </Button>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}
