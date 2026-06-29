"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Save } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import { ServiceLevel, type ServiceLevel as ServiceLevelValue } from "@/lib/enums"
import { toDateString } from "@/lib/utils"
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

export type AnalystOption = { id: string; name: string; department: string | null }

export type BioinfoExperimentTaskOption = {
  id: string
  taskNo: string
  experimentType: string
  project: { id: string; projectNo: string | null; customerOrg: string; serviceLevel: string }
}

type BioinfoFormValue = {
  id?: string
  analysisType?: string | null
  analystId?: string | null
  dataReceivedAt?: Date | string | null
  deliverableNote?: string | null
  remark?: string | null
  experimentTask?: { id: string; taskNo: string }
  project?: { projectNo: string | null }
}

type BioinfoTaskFormProps = {
  mode: "create" | "edit"
  task?: BioinfoFormValue
  experimentTaskOptions?: BioinfoExperimentTaskOption[]
  analystOptions: AnalystOption[]
  initialExperimentTaskId?: string
  /** modal = 在当前上下文 ?new 居中模态内创建（成功后关模态）；page = 全页表单（成功跳详情） */
  surface?: "page" | "modal"
}

const UNASSIGNED = "__unassigned__"

/** 服务档次 → 默认分析类型预填 */
const SERVICE_ANALYSIS_TYPE: Partial<Record<ServiceLevelValue, string>> = {
  [ServiceLevel.standard]: "标准分析",
  [ServiceLevel.advanced]: "高级分析",
}

function dateInputValue(value: Date | string | null | undefined) {
  return value ? toDateString(value) : ""
}

export function BioinfoTaskForm({
  mode,
  task,
  experimentTaskOptions = [],
  analystOptions,
  initialExperimentTaskId,
  surface = "page",
}: BioinfoTaskFormProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = React.useTransition()
  const [experimentTaskId, setExperimentTaskId] = React.useState(
    task?.experimentTask?.id || initialExperimentTaskId || ""
  )
  const [analystId, setAnalystId] = React.useState(task?.analystId || UNASSIGNED)
  const [analysisType, setAnalysisType] = React.useState(task?.analysisType ?? "")

  function onExperimentTaskChange(next: string) {
    setExperimentTaskId(next)
    if (!analysisType.trim()) {
      const picked = experimentTaskOptions.find((option) => option.id === next)
      const suggested = picked && SERVICE_ANALYSIS_TYPE[picked.project.serviceLevel as ServiceLevelValue]
      if (suggested) setAnalysisType(suggested)
    }
  }

  function closeModal() {
    const sp = new URLSearchParams(searchParams)
    sp.delete("new")
    sp.delete("experimentTaskId")
    router.push(sp.toString() ? `${pathname}?${sp.toString()}` : pathname, { scroll: false })
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const text = (key: string) => String(formData.get(key) || "").trim() || null

    if (mode === "create" && !experimentTaskId) {
      toast.error("请选择关联实验任务")
      return
    }

    const payload: Record<string, unknown> = {
      analysisType: analysisType.trim() || null,
      analystId: analystId === UNASSIGNED ? null : analystId,
      dataReceivedAt: text("dataReceivedAt"),
      remark: text("remark"),
    }
    if (mode === "edit") payload.deliverableNote = text("deliverableNote")

    const url =
      mode === "create"
        ? `/api/experiment-tasks/${experimentTaskId}/bioinfo-tasks`
        : `/api/bioinfo-tasks/${task?.id}`

    startTransition(async () => {
      const response = await fetch(url, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(result?.error || "保存生信任务失败")
        return
      }
      toast.success(mode === "create" ? "生信任务已创建" : "生信任务已更新")
      if (surface === "modal") {
        // 模态创建：关掉 ?new 模态、保留筛选/详情上下文
        closeModal()
        router.refresh()
      } else {
        // 硬导航直达全页详情：整页刷新确保详情页拿到刚保存的数据
        window.location.assign(`/bioinfo-tasks/${result.data.id}`)
      }
    })
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <div className="grid gap-5 md:grid-cols-2">
          {mode === "create" ? (
            <Field>
              <FieldLabel>关联实验任务</FieldLabel>
              <Select value={experimentTaskId} onValueChange={onExperimentTaskChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择已完成的实验任务" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {experimentTaskOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.taskNo} · {option.experimentType} · {option.project.projectNo}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>仅可选择已完成、所属项目含生信分析的实验任务。</FieldDescription>
            </Field>
          ) : (
            <Field>
              <FieldLabel>关联实验任务</FieldLabel>
              <Input
                value={`${task?.experimentTask?.taskNo ?? ""}${task?.project?.projectNo ? ` · ${task.project.projectNo}` : ""}`}
                disabled
              />
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="analysisType">分析类型</FieldLabel>
            <Input
              id="analysisType"
              value={analysisType}
              onChange={(event) => setAnalysisType(event.target.value)}
              placeholder="标准分析 / 高级分析 / 免疫组分析…"
            />
          </Field>
          <Field>
            <FieldLabel>分析负责人</FieldLabel>
            <Select value={analystId} onValueChange={setAnalystId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="未指派" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={UNASSIGNED}>未指派</SelectItem>
                  {analystOptions.map((analyst) => (
                    <SelectItem key={analyst.id} value={analyst.id}>
                      {analyst.name}
                      {analyst.department ? ` · ${analyst.department}` : ""}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="dataReceivedAt">数据接收日期</FieldLabel>
            <Input
              id="dataReceivedAt"
              name="dataReceivedAt"
              type="date"
              defaultValue={dateInputValue(task?.dataReceivedAt)}
            />
          </Field>
          {mode === "edit" && (
            <Field>
              <FieldLabel htmlFor="deliverableNote">交付物说明</FieldLabel>
              <Input
                id="deliverableNote"
                name="deliverableNote"
                defaultValue={task?.deliverableNote ?? ""}
                placeholder="报告、矩阵文件、图表等…"
              />
            </Field>
          )}
        </div>
        <Field>
          <FieldLabel htmlFor="remark">备注</FieldLabel>
          <Textarea id="remark" name="remark" defaultValue={task?.remark ?? ""} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (surface === "modal") closeModal()
              else router.back()
            }}
          >
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
