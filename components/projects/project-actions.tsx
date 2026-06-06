"use client"

import { useRouter } from "next/navigation"
import { AlertTriangle, Check, PackageCheck, RotateCcw, Send, XCircle } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import { ProjectStatus, type ProjectStatus as ProjectStatusValue } from "@/lib/enums"
import { getAvailableProjectActions, type ProjectAction } from "@/lib/projects/rules"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

type ProjectActionsProps = {
  projectId: string
  status: ProjectStatusValue
  role?: string
}

const actionConfig: Record<
  Exclude<ProjectAction, "markAbnormal" | "recover" | "terminate">,
  { label: string; path: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }
> = {
  confirm: { label: "确认项目", path: "confirm", icon: Check },
  markWaitingSample: { label: "标记待到样", path: "mark-waiting-sample", icon: Send },
  deliver: { label: "确认交付", path: "deliver", icon: PackageCheck },
  complete: { label: "完成项目", path: "complete", icon: Check },
}

export function ProjectActions({ projectId, status, role }: ProjectActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()
  const reasonRef = React.useRef<HTMLTextAreaElement>(null)
  const actions = getAvailableProjectActions(status, role)
  const simpleActions = actions.filter(
    (action): action is keyof typeof actionConfig => action in actionConfig
  )

  function runAction(action: ProjectAction, body?: Record<string, unknown>) {
    const config =
      action === "markAbnormal"
        ? { path: "mark-abnormal", label: "标记异常" }
        : action === "recover"
          ? { path: "recover", label: "恢复异常" }
          : action === "terminate"
            ? { path: "terminate", label: "异常终止" }
            : actionConfig[action]

    startTransition(async () => {
      const response = await fetch(`/api/projects/${projectId}/${config.path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(result?.error || `${config.label}失败`)
        return
      }
      toast.success(`${config.label}成功`)
      if (reasonRef.current) reasonRef.current.value = ""
      router.refresh()
    })
  }

  function getReason() {
    return reasonRef.current?.value ?? ""
  }

  if (actions.length === 0) {
    return <p className="text-sm text-muted-foreground">当前状态暂无可执行项目动作。</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {simpleActions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {simpleActions.map((action) => {
            const config = actionConfig[action]
            const Icon = config.icon
            return (
              <Button key={action} onClick={() => runAction(action)} disabled={isPending}>
                <Icon data-icon="inline-start" aria-hidden="true" />
                {config.label}
              </Button>
            )
          })}
        </div>
      )}

      {(actions.includes("markAbnormal") || actions.includes("recover") || actions.includes("terminate")) && (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="project-action-reason">
              {status === ProjectStatus.abnormal ? "处理说明" : "异常/终止原因"}
            </FieldLabel>
            <Textarea
              id="project-action-reason"
              ref={reasonRef}
              placeholder="记录原因…"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            {actions.includes("markAbnormal") && (
              <Button
                variant="destructive"
                disabled={isPending}
                onClick={() => runAction("markAbnormal", { reason: getReason() })}
              >
                <AlertTriangle data-icon="inline-start" aria-hidden="true" />
                标记异常
              </Button>
            )}
            {actions.includes("recover") && (
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() => runAction("recover", { reason: getReason() })}
              >
                <RotateCcw data-icon="inline-start" aria-hidden="true" />
                恢复异常
              </Button>
            )}
            {actions.includes("terminate") && (
              <Button
                variant="destructive"
                disabled={isPending}
                onClick={() => runAction("terminate", { reason: getReason() })}
              >
                <XCircle data-icon="inline-start" aria-hidden="true" />
                异常终止
              </Button>
            )}
          </div>
        </FieldGroup>
      )}
    </div>
  )
}
