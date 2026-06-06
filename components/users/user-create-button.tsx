"use client"

import { Plus } from "lucide-react"
import * as React from "react"
import { UserFormDialog } from "@/components/users/user-form-dialog"
import { Button } from "@/components/ui/button"

/** 新建用户入口：按钮 + 居中 Dialog（用户是管理配置记录，无深链诉求，不走拦截路由） */
export function UserCreateButton({ selfId }: { selfId: string }) {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" aria-hidden="true" />
        新建用户
      </Button>
      <UserFormDialog open={open} onOpenChange={setOpen} mode="create" selfId={selfId} />
    </>
  )
}
