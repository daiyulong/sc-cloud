"use client"

import { useRouter } from "next/navigation"
import { Save } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import { toDateString } from "@/lib/utils"
import type { OperatorOption } from "@/components/experiment-tasks/schedule-dialog"
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

export type TaskSampleOption = {
  id: string
  sampleNo: string
  species: string | null
  tissueType: string | null
  experimentType: string | null
  project: { id: string; projectNo: string | null; customerOrg: string }
}

type TaskFormValue = {
  id?: string
  experimentType?: string
  runMethod?: string | null
  department?: string | null
  plannedDate?: Date | string | null
  operatorId?: string | null
  loadedSampleCount?: number | null
  sample?: { id: string; sampleNo: string }
  project?: { projectNo: string | null }
}

type ExperimentTaskFormProps = {
  mode: "create" | "edit"
  task?: TaskFormValue
  sampleOptions?: TaskSampleOption[]
  operatorOptions: OperatorOption[]
  initialSampleId?: string
}

const UNASSIGNED = "__unassigned__"

function dateInputValue(value: Date | string | null | undefined) {
  return value ? toDateString(value) : ""
}

export function ExperimentTaskForm({
  mode,
  task,
  sampleOptions = [],
  operatorOptions,
  initialSampleId,
}: ExperimentTaskFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()
  const [sampleId, setSampleId] = React.useState(task?.sample?.id || initialSampleId || "")
  const [operatorId, setOperatorId] = React.useState(task?.operatorId || UNASSIGNED)
  const [experimentType, setExperimentType] = React.useState(task?.experimentType ?? "")

  function onSampleChange(next: string) {
    setSampleId(next)
    // 选中样本后，实验类型为空则用样本的实验类型预填（可改）
    if (!experimentType.trim()) {
      const picked = sampleOptions.find((option) => option.id === next)
      if (picked?.experimentType) setExperimentType(picked.experimentType)
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const text = (key: string) => String(formData.get(key) || "").trim() || null

    if (!experimentType.trim()) {
      toast.error("请输入实验类型")
      return
    }

    const payload: Record<string, unknown> = {
      experimentType: experimentType.trim(),
      runMethod: text("runMethod"),
      department: text("department"),
      plannedDate: text("plannedDate"),
      operatorId: operatorId === UNASSIGNED ? null : operatorId,
    }
    if (mode === "edit") payload.loadedSampleCount = text("loadedSampleCount")

    if (mode === "create" && !sampleId) {
      toast.error("请选择关联样本")
      return
    }

    const url =
      mode === "create"
        ? `/api/samples/${sampleId}/experiment-tasks`
        : `/api/experiment-tasks/${task?.id}`

    startTransition(async () => {
      const response = await fetch(url, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(result?.error || "保存实验任务失败")
        return
      }
      toast.success(mode === "create" ? "实验任务已创建" : "实验任务已更新")
      // 硬导航直达全页详情：软 push 会被 @sheet 拦截成「侧滑盖在表单上」
      window.location.assign(`/experiment-tasks/${result.data.id}`)
    })
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <div className="grid gap-5 md:grid-cols-2">
          {mode === "create" ? (
            <Field>
              <FieldLabel>关联样本</FieldLabel>
              <Select value={sampleId} onValueChange={onSampleChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择已接收样本" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {sampleOptions.map((sample) => (
                      <SelectItem key={sample.id} value={sample.id}>
                        {sample.sampleNo} · {sample.species}/{sample.tissueType} ·{" "}
                        {sample.project.projectNo}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>仅可选择已接收、项目处于已到样/实验中的样本。</FieldDescription>
            </Field>
          ) : (
            <Field>
              <FieldLabel>关联样本</FieldLabel>
              <Input
                value={`${task?.sample?.sampleNo ?? ""}${task?.project?.projectNo ? ` · ${task.project.projectNo}` : ""}`}
                disabled
              />
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="experimentType">实验类型</FieldLabel>
            <Input
              id="experimentType"
              value={experimentType}
              onChange={(event) => setExperimentType(event.target.value)}
              placeholder="组织解离 / 建库 / 上机 / 质控…"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="runMethod">上机方式</FieldLabel>
            <Input
              id="runMethod"
              name="runMethod"
              defaultValue={task?.runMethod ?? ""}
              placeholder="10x / GEM-X / Next GEM / 墨卓…"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="department">所属部门</FieldLabel>
            <Input
              id="department"
              name="department"
              defaultValue={task?.department ?? ""}
              placeholder="单细胞部 / 时空部…"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="plannedDate">计划实验日期</FieldLabel>
            <Input
              id="plannedDate"
              name="plannedDate"
              type="date"
              defaultValue={dateInputValue(task?.plannedDate)}
            />
            <FieldDescription>填写后任务直接进入已排期。</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>实验负责人</FieldLabel>
            <Select value={operatorId} onValueChange={setOperatorId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="未指派" />
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
          {mode === "edit" && (
            <Field>
              <FieldLabel htmlFor="loadedSampleCount">上机样本个数</FieldLabel>
              <Input
                id="loadedSampleCount"
                name="loadedSampleCount"
                type="number"
                min={0}
                step={1}
                defaultValue={task?.loadedSampleCount ?? ""}
              />
            </Field>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            取消
          </Button>
          <Button type="submit" disabled={isPending}>
            <Save data-icon="inline-start" aria-hidden="true" />
            保存任务
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}
