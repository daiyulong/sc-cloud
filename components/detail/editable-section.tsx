"use client"

import { Pencil, Save, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"
import { FieldLine } from "@/components/detail/field-line"
import { Button } from "@/components/ui/button"
import {
  Field,
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

const EMPTY_SELECT_VALUE = "__empty__"

type EditableSectionFieldOption = {
  value: string
  label: string
}

export type EditableSectionField = {
  name: string
  label: string
  value?: string | number | null
  displayValue?: string | number | null
  type?: "text" | "number" | "date" | "textarea" | "select"
  options?: EditableSectionFieldOption[]
  editable?: boolean
  required?: boolean
  placeholder?: string
  multiline?: boolean
  span?: "full"
  href?: string
  /**
   * 提交前对 draft 值做转换再发 body。
   * - `"json"`: draft 为 string，提交时 JSON.stringify 再发（接收端解析为数组/对象）。
   *   配合 `valueToDraft` 使用可实现"显示拼接文本、提交解析为数组"的往返语义。
   */
  submitAs?: "json"
}

/** 将 JSON 值转显示用拼接字符串（如 string[] → "S1、S2"） */
function jsonToDisplay(value: unknown): string {
  if (Array.isArray(value)) return value.join("、")
  if (value == null) return ""
  return String(value)
}

type EditableSectionProps = {
  title: string
  endpoint: string
  fields: EditableSectionField[]
  editable?: boolean
  editLabel?: string
  successMessage?: string
}

function valueToDraft(value: string | number | null | undefined) {
  if (value === null || value === undefined) return ""
  return String(value)
}

function fieldToDraft(field: EditableSectionField): string {
  if (field.submitAs === "json") return jsonToDisplay(field.value)
  return valueToDraft(field.value)
}

function getInitialDraft(fields: EditableSectionField[]) {
  return Object.fromEntries(
    fields
      .filter((field) => field.editable !== false)
      .map((field) => [field.name, fieldToDraft(field)])
  )
}

function getSpanClass(field: EditableSectionField) {
  return field.span === "full" ? "md:col-span-2" : undefined
}

function ReadField({ field }: { field: EditableSectionField }) {
  const displayValue =
    field.displayValue ?? (field.submitAs === "json" ? jsonToDisplay(field.value) : valueToDraft(field.value))
  const hasValue = String(displayValue).trim().length > 0
  const content =
    field.href && hasValue ? (
      <Link href={field.href} className="hover:underline">
        {String(displayValue)}
      </Link>
    ) : hasValue ? (
      String(displayValue)
    ) : null

  return (
    <FieldLine
      label={field.label}
      value={content}
      multiline={field.multiline}
      className={getSpanClass(field)}
    />
  )
}

export function EditableSection({
  title,
  endpoint,
  fields,
  editable = true,
  editLabel = "编辑",
  successMessage = "已保存",
}: EditableSectionProps) {
  const router = useRouter()
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState<Record<string, string>>(() => getInitialDraft(fields))
  const [isPending, startTransition] = React.useTransition()
  const idPrefix = React.useId()
  const canEdit = editable && fields.some((field) => field.editable !== false)

  function beginEdit() {
    setDraft(getInitialDraft(fields))
    setEditing(true)
  }

  function cancelEdit() {
    setDraft(getInitialDraft(fields))
    setEditing(false)
  }

  function updateDraft(name: string, value: string) {
    setDraft((current) => ({ ...current, [name]: value }))
  }

  function buildChangedBody() {
    const body: Record<string, unknown> = {}
    for (const field of fields) {
      if (field.editable === false) continue
      const current = draft[field.name] ?? ""
      const initial = fieldToDraft(field)
      if (field.required && current.trim().length === 0) {
        toast.error(`请填写${field.label}`)
        return null
      }
      if (current !== initial) {
        body[field.name] = field.submitAs === "json" ? current.split("、").filter(Boolean) : current
      }
    }
    return body as Record<string, string>
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = buildChangedBody()
    if (!body) return
    if (Object.keys(body).length === 0) {
      setEditing(false)
      return
    }

    startTransition(async () => {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(result?.error || `${title}保存失败`)
        return
      }
      toast.success(successMessage)
      setEditing(false)
      router.refresh()
    })
  }

  if (!editing || !canEdit) {
    return (
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium">{title}</h3>
          {canEdit && (
            <Button type="button" variant="outline" size="sm" onClick={beginEdit}>
              <Pencil data-icon="inline-start" aria-hidden="true" />
              {editLabel}
            </Button>
          )}
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {fields.map((field) => (
            <ReadField key={field.name} field={field} />
          ))}
        </div>
      </section>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">{title}</h3>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={cancelEdit} disabled={isPending}>
            <X data-icon="inline-start" aria-hidden="true" />
            取消
          </Button>
          <Button type="submit" size="sm" disabled={isPending}>
            <Save data-icon="inline-start" aria-hidden="true" />
            保存
          </Button>
        </div>
      </div>
      <FieldGroup className="grid gap-4 md:grid-cols-2">
        {fields.map((field) => {
          const id = `${idPrefix}-${field.name}`
          if (field.editable === false) {
            return <ReadField key={field.name} field={field} />
          }

          const value = draft[field.name] ?? ""
          return (
            <Field key={field.name} className={getSpanClass(field)}>
              <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
              {field.type === "textarea" ? (
                <Textarea
                  id={id}
                  name={field.name}
                  value={value}
                  onChange={(event) => updateDraft(field.name, event.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                  className="min-h-24 resize-y"
                />
              ) : field.type === "select" ? (
                <Select
                  value={value || EMPTY_SELECT_VALUE}
                  onValueChange={(next) =>
                    updateDraft(field.name, next === EMPTY_SELECT_VALUE ? "" : next)
                  }
                >
                  <SelectTrigger id={id} className="w-full">
                    <SelectValue placeholder={field.placeholder || "请选择"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {!field.required && <SelectItem value={EMPTY_SELECT_VALUE}>未设置</SelectItem>}
                      {field.options?.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={id}
                  name={field.name}
                  type={field.type === "date" || field.type === "number" ? field.type : "text"}
                  inputMode={field.type === "number" ? "numeric" : undefined}
                  value={value}
                  onChange={(event) => updateDraft(field.name, event.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                  autoComplete="off"
                />
              )}
            </Field>
          )
        })}
      </FieldGroup>
    </form>
  )
}
