"use client"

import { useRouter } from "next/navigation"
import { Save } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import {
  SERVICE_LEVEL_LABELS,
  ServiceLevel,
  USER_ROLE_LABELS,
  UserRole,
  type UserRole as UserRoleValue,
} from "@/lib/enums"
import { formatDate } from "@/lib/utils"
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

export type ProjectUserOption = {
  id: string
  name: string
  role: UserRoleValue
}

type ProjectFormValue = {
  id?: string
  projectNo?: string | null
  contractNo?: string
  orderNo?: string
  customerOrg?: string
  customerName?: string
  customerContact?: string | null
  salesOwnerId?: string | null
  projectManagerId?: string | null
  projectType?: string
  serviceItems?: string
  serviceLevel?: string
  sequencingPlatform?: string | null
  priority?: string
  expectedDeliveryDate?: Date | string | null
  remark?: string | null
}

type ProjectFormProps = {
  mode: "create" | "edit"
  project?: ProjectFormValue
  currentUser: { id: string; role?: UserRoleValue }
  salesUsers: ProjectUserOption[]
  managerUsers: ProjectUserOption[]
}

const NONE = "__none__"
const PRIORITIES = ["普通", "加急"] as const

function dateInputValue(value: Date | string | null | undefined) {
  if (!value) return ""
  if (typeof value === "string") return value.slice(0, 10)
  return formatDate(value, { year: "numeric", month: "2-digit", day: "2-digit" }).replaceAll(
    "/",
    "-"
  )
}

function textValue(value: string | null | undefined) {
  return value ?? ""
}

function formString(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim()
  return value || null
}

function formOptionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim()
  return value || undefined
}

export function ProjectForm({
  mode,
  project,
  currentUser,
  salesUsers,
  managerUsers,
}: ProjectFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()
  const [serviceLevel, setServiceLevel] = React.useState(
    project?.serviceLevel || ServiceLevel.standard
  )
  const [priority, setPriority] = React.useState(project?.priority || "普通")
  const [salesOwnerId, setSalesOwnerId] = React.useState(project?.salesOwnerId || NONE)
  const [projectManagerId, setProjectManagerId] = React.useState(
    project?.projectManagerId || NONE
  )
  const canAssignUsers =
    currentUser.role === UserRole.admin || currentUser.role === UserRole.project_manager

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const payload = {
      projectNo: formOptionalString(formData, "projectNo"),
      contractNo: formString(formData, "contractNo"),
      orderNo: formString(formData, "orderNo"),
      customerOrg: formString(formData, "customerOrg"),
      customerName: formString(formData, "customerName"),
      customerContact: formString(formData, "customerContact"),
      salesOwnerId: canAssignUsers && salesOwnerId !== NONE ? salesOwnerId : null,
      projectManagerId: canAssignUsers && projectManagerId !== NONE ? projectManagerId : null,
      projectType: formString(formData, "projectType"),
      serviceItems: formString(formData, "serviceItems"),
      serviceLevel,
      sequencingPlatform: formString(formData, "sequencingPlatform"),
      priority,
      expectedDeliveryDate: formString(formData, "expectedDeliveryDate"),
      remark: formString(formData, "remark"),
    }

    startTransition(async () => {
      const response = await fetch(mode === "create" ? "/api/projects" : `/api/projects/${project?.id}`, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(result?.error || "保存项目失败")
        return
      }

      toast.success(mode === "create" ? "项目已创建" : "项目已更新")
      router.push(`/projects/${result.data.id}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <div className="grid gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="orderNo">委托单编号</FieldLabel>
            <Input id="orderNo" name="orderNo" defaultValue={project?.orderNo} required />
            <FieldDescription>项目默认以委托单编号作为业务项目编号。</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="projectNo">项目编号</FieldLabel>
            <Input id="projectNo" name="projectNo" defaultValue={textValue(project?.projectNo)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="contractNo">合同编号</FieldLabel>
            <Input id="contractNo" name="contractNo" defaultValue={project?.contractNo} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="customerOrg">客户单位</FieldLabel>
            <Input id="customerOrg" name="customerOrg" defaultValue={project?.customerOrg} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="customerName">客户姓名</FieldLabel>
            <Input id="customerName" name="customerName" defaultValue={project?.customerName} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="customerContact">联系方式</FieldLabel>
            <Input
              id="customerContact"
              name="customerContact"
              defaultValue={textValue(project?.customerContact)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="projectType">项目类型</FieldLabel>
            <Input
              id="projectType"
              name="projectType"
              defaultValue={project?.projectType || "单细胞转录组"}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="serviceItems">服务内容</FieldLabel>
            <Input id="serviceItems" name="serviceItems" defaultValue={project?.serviceItems} required />
          </Field>
          <Field>
            <FieldLabel>服务档次</FieldLabel>
            <Select value={serviceLevel} onValueChange={setServiceLevel}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {Object.values(ServiceLevel).map((value) => (
                    <SelectItem key={value} value={value}>
                      {SERVICE_LEVEL_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>优先级</FieldLabel>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {PRIORITIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="sequencingPlatform">测序平台</FieldLabel>
            <Input
              id="sequencingPlatform"
              name="sequencingPlatform"
              defaultValue={textValue(project?.sequencingPlatform)}
              placeholder="Illumina / 真迈…"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="expectedDeliveryDate">预计交付日期</FieldLabel>
            <Input
              id="expectedDeliveryDate"
              name="expectedDeliveryDate"
              type="date"
              defaultValue={dateInputValue(project?.expectedDeliveryDate)}
            />
          </Field>
          {canAssignUsers && (
            <>
              <Field>
                <FieldLabel>销售负责人</FieldLabel>
                <Select value={salesOwnerId} onValueChange={setSalesOwnerId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择销售负责人" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={NONE}>未指定</SelectItem>
                      {salesUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} · {USER_ROLE_LABELS[user.role]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>项目经理</FieldLabel>
                <Select value={projectManagerId} onValueChange={setProjectManagerId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择项目经理" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={NONE}>未指定</SelectItem>
                      {managerUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} · {USER_ROLE_LABELS[user.role]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}
        </div>
        <Field>
          <FieldLabel htmlFor="remark">备注</FieldLabel>
          <Textarea id="remark" name="remark" defaultValue={textValue(project?.remark)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            取消
          </Button>
          <Button type="submit" disabled={isPending}>
            <Save data-icon="inline-start" aria-hidden="true" />
            保存项目
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}
