"use client"

import * as React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export type ProjectDetailTabItem = {
  value: string
  label: React.ReactNode
  content: React.ReactNode
}

/**
 * 项目详情分段导航。即时切换（useState，数据已一次性加载、零重取），
 * 同时把 `?tab=` 写进地址栏（history.replaceState，不触发 Next 服务端重渲染）——
 * 刷新 / 深链由服务端读 `?tab=` 设初始页。首个 tab 为默认页、不写参数。
 */
export function ProjectDetailTabs({
  items,
  defaultValue,
}: {
  items: ProjectDetailTabItem[]
  defaultValue: string
}) {
  const [value, setValue] = React.useState(defaultValue)
  const baseValue = items[0]?.value

  function onValueChange(next: string) {
    setValue(next)
    if (typeof window === "undefined") return
    const sp = new URLSearchParams(window.location.search)
    if (next === baseValue) sp.delete("tab")
    else sp.set("tab", next)
    const qs = sp.toString()
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    )
  }

  return (
    <Tabs value={value} onValueChange={onValueChange}>
      <TabsList variant="line" className="w-full justify-start">
        {items.map((item) => (
          <TabsTrigger key={item.value} value={item.value} className="flex-none">
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {items.map((item) => (
        <TabsContent key={item.value} value={item.value} className="flex flex-col gap-5">
          {item.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
