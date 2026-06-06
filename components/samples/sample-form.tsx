"use client"

import { useRouter } from "next/navigation"
import { Save } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import { PROJECT_STATUS_LABELS, type ProjectStatus as ProjectStatusValue } from "@/lib/enums"
import { toDateString } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
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

export type SampleProjectOption = {
  id: string
  projectNo: string
  customerOrg: string
  status: ProjectStatusValue
}

type SampleFormValue = {
  id?: string
  sampleNo?: string
  species?: string
  tissueType?: string
  sampleCount?: number | null
  experimentType?: string
  transportCondition?: string
  samplingDate?: Date | string | null
  expectedArrivalDate?: Date | string | null
  remark?: string | null
  project?: { id: string; projectNo: string; customerOrg: string }
}

type SampleFormProps = {
  mode: "create" | "edit"
  sample?: SampleFormValue
  projectOptions?: SampleProjectOption[]
  initialProjectId?: string
}

function dateInputValue(value: Date | string | null | undefined) {
  if (!value) return ""
  return toDateString(value)
}

function textValue(value: string | null | undefined) {
  return value ?? ""
}

function formString(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim()
  return value || null
}

export function SampleForm({ mode, sample, projectOptions = [], initialProjectId }: SampleFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()
  const [projectId, setProjectId] = React.useState(
    sample?.project?.id || initialProjectId || ""
  )

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const payload: Record<string, unknown> = {
      sampleNo: formString(formData, "sampleNo"),
      species: formString(formData, "species"),
      tissueType: formString(formData, "tissueType"),
      sampleCount: formString(formData, "sampleCount"),
      experimentType: formString(formData, "experimentType"),
      transportCondition: formString(formData, "transportCondition"),
      samplingDate: formString(formData, "samplingDate"),
      expectedArrivalDate: formString(formData, "expectedArrivalDate"),
      remark: formString(formData, "remark"),
    }
    if (mode === "create") {
      if (!projectId) {
        toast.error("请选择所属项目")
        return
      }
      payload.projectId = projectId
    }

    startTransition(async () => {
      const response = await fetch(
        mode === "create" ? "/api/samples" : `/api/samples/${sample?.id}`,
        {
          method: mode === "create" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(result?.error || "保存样本失败")
        return
      }

      toast.success(mode === "create" ? "样本已登记" : "样本已更新")
      // 硬导航直达全页详情：软 push 会被 @sheet 拦截成「侧滑盖在表单上」
      window.location.assign(`/samples/${result.data.id}`)
    })
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <div className="grid gap-5 md:grid-cols-2">
          {mode === "create" ? (
            <Field>
              <FieldLabel>所属项目</FieldLabel>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {projectOptions.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.projectNo} · {project.customerOrg} ·{" "}
                        {PROJECT_STATUS_LABELS[project.status]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>样本归属委托单粒度的项目，创建后不可变更。</FieldDescription>
            </Field>
          ) : (
            <Field>
              <FieldLabel>所属项目</FieldLabel>
              <Input
                value={`${sample?.project?.projectNo ?? ""} · ${sample?.project?.customerOrg ?? ""}`}
                disabled
              />
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="sampleNo">样品编号</FieldLabel>
            <Input id="sampleNo" name="sampleNo" defaultValue={sample?.sampleNo} required />
            <FieldDescription>业务样本表内唯一，例如 YP-xxxx。</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="species">样本物种</FieldLabel>
            <Input
              id="species"
              name="species"
              defaultValue={sample?.species}
              placeholder="人 / 小鼠 / 大鼠…"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="tissueType">组织类型</FieldLabel>
            <Input
              id="tissueType"
              name="tissueType"
              defaultValue={sample?.tissueType}
              placeholder="肺组织 / 肝脏组织…"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="sampleCount">样本数量</FieldLabel>
            <Input
              id="sampleCount"
              name="sampleCount"
              type="number"
              min={0}
              step={1}
              defaultValue={sample?.sampleCount ?? ""}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="experimentType">实验类型</FieldLabel>
            <Input
              id="experimentType"
              name="experimentType"
              defaultValue={sample?.experimentType}
              placeholder="组织解离 / 细胞核 / 建库 / 上机…"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="transportCondition">运输条件</FieldLabel>
            <Input
              id="transportCondition"
              name="transportCondition"
              defaultValue={sample?.transportCondition}
              placeholder="4℃ / 冷链 / 干冰…"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="samplingDate">客户取样日期</FieldLabel>
            <Input
              id="samplingDate"
              name="samplingDate"
              type="date"
              defaultValue={dateInputValue(sample?.samplingDate)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="expectedArrivalDate">预计到样日期</FieldLabel>
            <Input
              id="expectedArrivalDate"
              name="expectedArrivalDate"
              type="date"
              defaultValue={dateInputValue(sample?.expectedArrivalDate)}
            />
            <FieldDescription>不能早于客户取样日期（同日可）。</FieldDescription>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="remark">备注</FieldLabel>
          <Textarea id="remark" name="remark" defaultValue={textValue(sample?.remark)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            取消
          </Button>
          <Button type="submit" disabled={isPending}>
            <Save data-icon="inline-start" aria-hidden="true" />
            保存样本
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}
