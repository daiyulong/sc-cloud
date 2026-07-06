"use client"

import { CalendarClock, PlayCircle, Send } from "lucide-react"
import * as React from "react"
import {
  RESULT_STATUS_LABELS,
  ResultStatus,
  type ExperimentTaskStatus as ExperimentTaskStatusValue,
  type ResultStatus as ResultStatusValue,
} from "@/lib/enums"
import { ExperimentTaskStatus } from "@/lib/enums"
import { todayString } from "@/lib/utils"
import { useEntityAction } from "@/components/detail/use-entity-action"
import { ActionPanel } from "@/components/detail/action-panel"
import { FillContractNoDialog } from "@/components/projects/fill-contract-no-dialog"
import type { FeedbackAnalystOption, OperatorOption } from "@/components/experiment-tasks/types"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const UNASSIGNED = "__unassigned__"

type ExperimentTaskPrimaryActionProps = {
  taskId: string
  projectId: string
  status: ExperimentTaskStatusValue
  plannedDate?: string | null
  actualDate?: string | null
  operatorId?: string | null
  runMethod?: string | null
  department?: string | null
  operatorOptions: OperatorOption[]
  bioinfoEnabled: boolean
  analystOptions: FeedbackAnalystOption[]
}

function panelTitle(status: ExperimentTaskStatusValue) {
  switch (status) {
    case ExperimentTaskStatus.waiting_schedule:
      return "安排实验"
    case ExperimentTaskStatus.scheduled:
      return "开始实验"
    case ExperimentTaskStatus.in_progress:
      return "提交实验结果"
    case ExperimentTaskStatus.waiting_feedback:
      return "补交实验结果"
    default:
      return null
  }
}

function panelDescription(status: ExperimentTaskStatusValue, bioinfoEnabled: boolean) {
  switch (status) {
    case ExperimentTaskStatus.waiting_schedule:
      return "填写计划日期、负责人和上机方式后，任务进入已排期。"
    case ExperimentTaskStatus.scheduled:
      return "确认开始后记录实际实验日期，并推进样本与项目进入实验中。"
    case ExperimentTaskStatus.in_progress:
      return bioinfoEnabled
        ? "录入实验结果并可指定生信分析员，提交后自动流转到生信。"
        : "录入实验结果，提交后进入待交付。"
    case ExperimentTaskStatus.waiting_feedback:
      return bioinfoEnabled
        ? "补交实验结果并可指定生信分析员，提交后自动流转到生信。"
        : "补交实验结果，提交后进入待交付。"
    default:
      return null
  }
}

function panelIcon(status: ExperimentTaskStatusValue) {
  switch (status) {
    case ExperimentTaskStatus.waiting_schedule:
      return <CalendarClock aria-hidden="true" />
    case ExperimentTaskStatus.scheduled:
      return <PlayCircle aria-hidden="true" />
    case ExperimentTaskStatus.in_progress:
    case ExperimentTaskStatus.waiting_feedback:
      return <Send aria-hidden="true" />
    default:
      return null
  }
}

export function ExperimentTaskPrimaryAction({
  taskId,
  projectId,
  status,
  plannedDate,
  actualDate,
  operatorId,
  runMethod,
  department,
  operatorOptions,
  bioinfoEnabled,
  analystOptions,
}: ExperimentTaskPrimaryActionProps) {
  const title = panelTitle(status)
  const description = panelDescription(status, bioinfoEnabled)
  const { run, isPending } = useEntityAction()

  // 预约实验前弹窗状态（需求 2026-07）
  const [showContractNoDialog, setShowContractNoDialog] = React.useState(false)

  if (!title || !description) return null

  return (
    <>
      <ActionPanel icon={panelIcon(status)} title={title} description={description}>
        {status === ExperimentTaskStatus.waiting_schedule && (
          <ScheduleInlineForm
            plannedDate={plannedDate}
            operatorId={operatorId}
            runMethod={runMethod}
            department={department}
            operatorOptions={operatorOptions}
            isPending={isPending}
            onSubmit={(body) => {
              run(
                `/api/experiment-tasks/${taskId}/schedule`,
                "设置排期",
                body,
                undefined,
                (err) => {
                  if (err.code === "NEED_CONTRACT_NO") {
                    setShowContractNoDialog(true)
                    return true
                  }
                  return false
                }
              )
            }}
          />
        )}

        {status === ExperimentTaskStatus.scheduled && (
          <StartInlineAction
            actualDate={actualDate}
            isPending={isPending}
            onSubmit={(body) => run(`/api/experiment-tasks/${taskId}/start`, "开始实验", body)}
          />
        )}

        {(status === ExperimentTaskStatus.in_progress ||
          status === ExperimentTaskStatus.waiting_feedback) && (
          <FeedbackInlineForm
            status={status}
            actualDate={actualDate}
            bioinfoEnabled={bioinfoEnabled}
            analystOptions={analystOptions}
            isPending={isPending}
            onSubmit={(body) =>
              run(`/api/experiment-tasks/${taskId}/feedback`, "提交实验结果", body)
            }
            onFinishOnly={(body) =>
              run(`/api/experiment-tasks/${taskId}/finish`, "完成实验", body)
            }
          />
        )}
      </ActionPanel>

      <FillContractNoDialog
        open={showContractNoDialog}
        onOpenChange={setShowContractNoDialog}
        projectId={projectId}
        onConfirmed={() => setShowContractNoDialog(false)}
      />
    </>
  )
}

/* -------------------------------------------------------------------------
 * 以下三个内联表单组件保持与原始实现完全一致，仅修改了 ScheduleInlineForm
 * 的 onSubmit 签名（加 onError 参数），其余未改动。
 * ------------------------------------------------------------------------- */

function ScheduleInlineForm({
  plannedDate,
  operatorId,
  runMethod,
  department,
  operatorOptions,
  isPending,
  onSubmit,
}: {
  plannedDate?: string | null
  operatorId?: string | null
  runMethod?: string | null
  department?: string | null
  operatorOptions: OperatorOption[]
  isPending: boolean
  onSubmit: (
    body: {
      plannedDate: string
      operatorId: string | null
      runMethod: string | null
      department: string | null
    },
    onError?: (err: { error: string; code?: string }) => boolean
  ) => void
}) {
  const [date, setDate] = React.useState(plannedDate || todayString())
  const [assignee, setAssignee] = React.useState(operatorId || UNASSIGNED)
  const [method, setMethod] = React.useState(runMethod ?? "")
  const [dept, setDept] = React.useState(department ?? "")
  const [showError, setShowError] = React.useState(false)
  const invalid = showError && !date

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!date) {
      setShowError(true)
      return
    }
    onSubmit({
      plannedDate: date,
      operatorId: assignee === UNASSIGNED ? null : assignee,
      runMethod: method.trim() || null,
      department: dept.trim() || null,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup className="gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={invalid || undefined}>
            <FieldLabel htmlFor="task-primary-planned-date">计划实验日期</FieldLabel>
            <Input
              id="task-primary-planned-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              aria-invalid={invalid || undefined}
            />
            {invalid && (
              <FieldDescription className="text-destructive">
                请填写计划实验日期。
              </FieldDescription>
            )}
          </Field>
          <Field>
            <FieldLabel>实验负责人</FieldLabel>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={UNASSIGNED}>未指派</SelectItem>
                  {operatorOptions.map((operator) => (
                    <SelectItem key={operator.id} value={operator.id}>
                      {operator.name}
                      {operator.department ? ` · ${operator.department}` : ""}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="task-primary-run-method">上机方式</FieldLabel>
            <Input
              id="task-primary-run-method"
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              placeholder="10x / GEM-X / Next GEM / 墨卓…"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="task-primary-department">所属部门</FieldLabel>
            <Input
              id="task-primary-department"
              value={dept}
              onChange={(event) => setDept(event.target.value)}
              placeholder="单细胞部 / 时空部…"
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            <CalendarClock data-icon="inline-start" aria-hidden="true" />
            设置排期
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}

function StartInlineAction({
  actualDate,
  isPending,
  onSubmit,
}: {
  actualDate?: string | null
  isPending: boolean
  onSubmit: (body: { actualDate: string | null }) => void
}) {
  const [date, setDate] = React.useState(actualDate || todayString())

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit({ actualDate: date || null })
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="task-primary-actual-date">实际实验日期</FieldLabel>
          <Input
            id="task-primary-actual-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            <PlayCircle data-icon="inline-start" aria-hidden="true" />
            开始实验
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}

function FeedbackInlineForm({
  status,
  actualDate,
  bioinfoEnabled,
  analystOptions,
  isPending,
  onSubmit,
  onFinishOnly,
}: {
  status: ExperimentTaskStatusValue
  actualDate?: string | null
  bioinfoEnabled: boolean
  analystOptions: FeedbackAnalystOption[]
  isPending: boolean
  onSubmit: (body: {
    resultStatus: ResultStatusValue
    resultFeedback: string
    actualDate: string | null
    bioinfoAnalystId: string | null
  }) => void
  onFinishOnly: (body: { actualDate: string | null }) => void
}) {
  const [resultStatus, setResultStatus] = React.useState<ResultStatusValue>(
    ResultStatus.normal_run
  )
  const [feedback, setFeedback] = React.useState("")
  const [date, setDate] = React.useState(actualDate || todayString())
  const [analystId, setAnalystId] = React.useState(UNASSIGNED)
  const [showError, setShowError] = React.useState(false)
  const invalid = showError && !feedback.trim()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!feedback.trim()) {
      setShowError(true)
      return
    }
    onSubmit({
      resultStatus,
      resultFeedback: feedback.trim(),
      actualDate: date || null,
      bioinfoAnalystId: bioinfoEnabled && analystId !== UNASSIGNED ? analystId : null,
    })
  }

  function handleFinishOnlySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onFinishOnly({ actualDate: date || null })
  }

  function handleFinishOnlyClick() {
    onFinishOnly({ actualDate: date || null })
  }

  const isInProgress = status === ExperimentTaskStatus.in_progress

  return (
    <form onSubmit={isInProgress ? handleSubmit : handleFinishOnlySubmit}>
      <FieldGroup className="gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>实验结果</FieldLabel>
            <Select
              value={resultStatus}
              onValueChange={(v) => setResultStatus(v as ResultStatusValue)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {Object.values(ResultStatus).map((v) => (
                    <SelectItem key={v} value={v}>
                      {RESULT_STATUS_LABELS[v]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          {bioinfoEnabled && (
            <Field className="sm:col-span-2">
              <FieldLabel>生信分析员</FieldLabel>
              <Select value={analystId} onValueChange={setAnalystId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="暂不指定" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={UNASSIGNED}>暂不指定</SelectItem>
                    {analystOptions.map((analyst) => (
                      <SelectItem key={analyst.id} value={analyst.id}>
                        {analyst.name}
                        {analyst.department ? ` · ${analyst.department}` : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>不指定时，生信任务进入待分配队列。</FieldDescription>
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="task-primary-feedback-date">实际实验日期</FieldLabel>
            <Input
              id="task-primary-feedback-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
        </div>
        <Field data-invalid={invalid || undefined} className="sm:col-span-2">
          <FieldLabel htmlFor="task-primary-feedback">结果说明</FieldLabel>
          <Textarea
            id="task-primary-feedback"
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            placeholder="实验结果与说明…"
            aria-invalid={invalid || undefined}
          />
          <FieldDescription className={invalid ? "text-destructive" : undefined}>
            结果说明必填。
          </FieldDescription>
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          {status === ExperimentTaskStatus.in_progress && (
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={handleFinishOnlyClick}
            >
              <Send data-icon="inline-start" aria-hidden="true" />
              仅标记完成
            </Button>
          )}
          <Button type="submit" disabled={isPending}>
            <Send data-icon="inline-start" aria-hidden="true" />
            提交结果
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}
