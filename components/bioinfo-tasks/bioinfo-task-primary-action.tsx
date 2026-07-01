"use client"

import { PlayCircle, Send } from "lucide-react"
import * as React from "react"
import {
  BioinfoTaskStatus,
  UserRole,
  type BioinfoTaskStatus as BioinfoTaskStatusValue,
} from "@/lib/enums"
import { useEntityAction } from "@/components/detail/use-entity-action"
import { ActionPanel } from "@/components/detail/action-panel"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SubmitDialog, type SubmitBioinfoBody } from "./submit-dialog"

type BioinfoTaskPrimaryActionProps = {
  taskId: string
  taskNo: string
  status: BioinfoTaskStatusValue
  analysisType: string | null
  role?: string
  currentAnalystId: string | null
  analystOptions: { value: string; label: string }[]
}

/**
 * 生信任务主动作：按状态切换主动作入口。
 * pending → 开始分析（分析员本人或已分配任务直接开始并自动认领；未分配且非分析员须先指定负责人）；
 * in_progress / waiting_review → 打开提交报告 Dialog。
 * 其余状态（waiting_delivery / delivered / abnormal）不入主动作区。
 */
export function BioinfoTaskPrimaryAction({
  taskId,
  taskNo,
  status,
  analysisType,
  role,
  currentAnalystId,
  analystOptions,
}: BioinfoTaskPrimaryActionProps) {
  const { run, isPending } = useEntityAction()
  const [submitOpen, setSubmitOpen] = React.useState(false)

  if (status === BioinfoTaskStatus.pending) {
    // 已分配 / 分析员本人 → 直接开始（后端自动认领当前分析员）；否则须先指定负责人。
    const canStartDirectly = Boolean(currentAnalystId) || role === UserRole.bioinfo_analyst
    return (
      <ActionPanel
        icon={<PlayCircle aria-hidden="true" />}
        title="开始分析"
        taskNo={taskNo}
        description={
          canStartDirectly
            ? "进入分析后可提交报告，提交审核为可选中间步。"
            : "该任务尚未分配负责人，请先指定后再开始（进入分析中即锁定负责人）。"
        }
      >
        {canStartDirectly ? (
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={isPending}
              onClick={() => run(`/api/bioinfo-tasks/${taskId}/start`, "开始分析")}
            >
              <PlayCircle data-icon="inline-start" aria-hidden="true" />
              开始分析
            </Button>
          </div>
        ) : (
          <StartAssignInlineForm
            analystOptions={analystOptions}
            isPending={isPending}
            onSubmit={(analystId) =>
              run(`/api/bioinfo-tasks/${taskId}/start`, "开始分析", { analystId })
            }
          />
        )}
      </ActionPanel>
    )
  }

  if (
    status === BioinfoTaskStatus.in_progress ||
    status === BioinfoTaskStatus.waiting_review
  ) {
    const label =
      status === BioinfoTaskStatus.in_progress ? "提交报告" : "补交报告"
    return (
      <ActionPanel
        icon={<Send aria-hidden="true" />}
        title={label}
        taskNo={taskNo}
        description="提交后进入待交付，由项目经理确认交付。"
      >
        <div className="flex justify-end">
          <Button
            type="button"
            disabled={isPending}
            onClick={() => setSubmitOpen(true)}
          >
            <Send data-icon="inline-start" aria-hidden="true" />
            {label}
          </Button>
        </div>
        <SubmitDialog
          open={submitOpen}
          onOpenChange={setSubmitOpen}
          taskNo={taskNo}
          defaultAnalysisType={analysisType}
          isPending={isPending}
          onConfirm={(body: SubmitBioinfoBody) =>
            run(`/api/bioinfo-tasks/${taskId}/submit`, label, body, () =>
              setSubmitOpen(false),
            )
          }
        />
      </ActionPanel>
    )
  }

  return null
}

/** 未分配任务、由非分析员推进开始时：先选一个分析负责人再开始。 */
function StartAssignInlineForm({
  analystOptions,
  isPending,
  onSubmit,
}: {
  analystOptions: { value: string; label: string }[]
  isPending: boolean
  onSubmit: (analystId: string) => void
}) {
  const [analystId, setAnalystId] = React.useState("")

  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel>分析负责人</FieldLabel>
        <Select value={analystId} onValueChange={setAnalystId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="选择分析负责人" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {analystOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <div className="flex justify-end">
        <Button
          type="button"
          disabled={isPending || !analystId}
          onClick={() => analystId && onSubmit(analystId)}
        >
          <PlayCircle data-icon="inline-start" aria-hidden="true" />
          开始分析
        </Button>
      </div>
    </div>
  )
}
