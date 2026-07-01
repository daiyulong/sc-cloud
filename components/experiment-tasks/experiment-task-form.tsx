"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, Save } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import { toDateString } from "@/lib/utils"
import type { OperatorOption } from "@/components/experiment-tasks/types"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export type TaskSampleOption = {
  id: string
  sampleName: string | null
  species: string | null
  tissueType: string | null
  batch: { id: string; batchNo: string | null; experimentType: string | null; seq: number } | null
  project: { id: string; projectNo: string | null; customerOrg: string }
}

type TaskFormValue = {
  id?: string
  experimentType?: string
  runMethod?: string | null
  department?: string | null
  plannedDate?: Date | string | null
  operatorId?: string | null
  taskSamples?: { sample: { id: string; sampleName: string | null } }[]
  project?: { projectNo: string | null }
}

type ExperimentTaskFormProps = {
  mode: "create" | "edit"
  task?: TaskFormValue
  sampleOptions?: TaskSampleOption[]
  operatorOptions: OperatorOption[]
  /** create 模式预填：来自 URL ?sampleIds= 或 ?sampleBatchId=；edit 模式忽略 */
  initialSampleIds?: string[]
  /** create 模式预填：来自排期视图选中的计划实验日期 */
  initialPlannedDate?: string
  /** modal = 在当前上下文 ?new 居中模态内创建（成功后关模态）；page = 全页表单（成功跳详情） */
  surface?: "page" | "modal"
}

const UNASSIGNED = "__unassigned__"

function dateInputValue(value: Date | string | null | undefined) {
  return value ? toDateString(value) : ""
}

/** 按 YP 批次折叠分组：预约入口按批次选择，提交时仍落到样本叶子关联。 */
function groupSamplesByBatch(options: TaskSampleOption[]) {
  const map = new Map<string, { batchId: string; batchNo: string; items: TaskSampleOption[] }>()
  for (const s of options) {
    const key = s.batch?.id ?? "_unassigned"
    const label = s.batch?.batchNo ?? "未分配批次"
    if (!map.has(key)) map.set(key, { batchId: key, batchNo: label, items: [] })
    map.get(key)!.items.push(s)
  }
  return Array.from(map.values())
}

export function ExperimentTaskForm({
  mode,
  task,
  sampleOptions = [],
  operatorOptions,
  initialSampleIds = [],
  initialPlannedDate,
  surface = "page",
}: ExperimentTaskFormProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = React.useTransition()
  // create 模式：多选 sampleIds；edit 模式：仅展示 disabled Input（不动）
  const [sampleIds, setSampleIds] = React.useState<Set<string>>(() => {
    if (mode === "edit") return new Set(task?.taskSamples?.map((ts) => ts.sample.id) ?? [])
    if (initialSampleIds.length > 0) return new Set(initialSampleIds)
    return new Set()
  })
  const [operatorId, setOperatorId] = React.useState(task?.operatorId || UNASSIGNED)
  const [experimentType, setExperimentType] = React.useState(task?.experimentType ?? "")
  const userTouchedExperimentType = React.useRef(false)

  const grouped = React.useMemo(() => groupSamplesByBatch(sampleOptions), [sampleOptions])

  // experimentType 自动预填：仅当 user 没手填过、且所有选中批次共享同一 batch.experimentType。
  // 命令式：在 toggleBatch 的 setSampleIds updater 里同步调用（避免 setState in useEffect）。
  // 闭包里的 experimentType 是上次 render 快照，但 userTouchedRef 是同步 ref，已能精准守护：
  //  - 用户从没动过 → userTouchedRef.current === false → 走 autoFill
  //  - 用户已动过 → userTouchedRef.current === true → 直接 return，与 experimentType 是否 stale 无关
  function autoFillExperimentType(ids: Set<string>) {
    if (userTouchedExperimentType.current) return
    if (ids.size === 0) return
    const picked = sampleOptions.filter((s) => ids.has(s.id))
    const types = Array.from(
      new Set(picked.map((p) => p.batch?.experimentType ?? "").filter(Boolean))
    )
    if (types.length === 1) setExperimentType(types[0])
  }

  function toggleBatch(items: TaskSampleOption[]) {
    setSampleIds((prev) => {
      const next = new Set(prev)
      const allSelected = items.every((it) => next.has(it.id))
      for (const it of items) {
        if (allSelected) next.delete(it.id)
        else next.add(it.id)
      }
      autoFillExperimentType(next)
      return next
    })
  }

  function clearAll() {
    setSampleIds(new Set())
  }

  function closeModal() {
    const sp = new URLSearchParams(searchParams)
    sp.delete("new")
    sp.delete("sampleId")
    sp.delete("sampleIds")
    sp.delete("sampleBatchId")
    router.push(sp.toString() ? `${pathname}?${sp.toString()}` : pathname, { scroll: false })
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const text = (key: string) => String(formData.get(key) || "").trim() || null

    if (!experimentType.trim()) {
      toast.error("请输入实验类型")
      return
    }

    if (mode === "create" && sampleIds.size === 0) {
      toast.error("请选择至少一个样本批次")
      return
    }

    const payload: Record<string, unknown> = {
      experimentType: experimentType.trim(),
      runMethod: text("runMethod"),
      department: text("department"),
      plannedDate: text("plannedDate"),
      operatorId: operatorId === UNASSIGNED ? null : operatorId,
    }

    const url =
      mode === "create"
        ? `/api/experiment-tasks`
        : `/api/experiment-tasks/${task?.id}`

    const body: Record<string, unknown> =
      mode === "create" ? { ...payload, sampleIds: Array.from(sampleIds) } : payload

    startTransition(async () => {
      const response = await fetch(url, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(result?.error || "保存实验任务失败")
        return
      }
      toast.success(mode === "create" ? "实验任务已创建" : "实验任务已更新")
      if (surface === "modal") {
        // 模态创建：关掉 ?new 模态、保留筛选/详情上下文
        closeModal()
        router.refresh()
      } else {
        // 全页表单兼容入口：保存后回到实验工位工作区。
        window.location.assign(`/lab?view=${result.data.id}`)
      }
    })
  }

  const selectedBatchCount = grouped.filter((group) =>
    group.items.some((item) => sampleIds.has(item.id))
  ).length
  const triggerLabel =
    sampleIds.size === 0
      ? "选择样本批次"
      : `已选 ${selectedBatchCount} 个批次 · ${sampleIds.size} 个样本`

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <div className="grid gap-5 md:grid-cols-2">
          {mode === "create" ? (
            <Field>
              <FieldLabel>关联批次</FieldLabel>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">{triggerLabel}</span>
                    <ChevronDown aria-hidden="true" className="h-4 w-4 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[min(92vw,440px)] max-h-[60vh] overflow-y-auto p-1"
                >
                  {grouped.length === 0 && (
                    <p className="px-2 py-3 text-sm text-muted-foreground">
                      当前没有可预约的样本批次（请先完成收样）。
                    </p>
                  )}
                  {grouped.map((group, idx) => {
                    const checked = group.items.some((it) => sampleIds.has(it.id))
                    return (
                      <div key={group.batchId}>
                        {idx > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuCheckboxItem
                          checked={checked}
                          onCheckedChange={() => toggleBatch(group.items)}
                          onSelect={(event) => event.preventDefault()}
                        >
                          <span className="truncate">
                            {group.batchNo} · {group.items.length} 个样本
                          </span>
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                            整批预约
                          </span>
                        </DropdownMenuCheckboxItem>
                      </div>
                    )
                  })}
                  {sampleIds.size > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <div className="flex items-center justify-between px-2 py-1.5">
                        <span className="text-xs text-muted-foreground">
                          已选 {sampleIds.size} 个样本
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={clearAll}
                        >
                          清空
                        </Button>
                      </div>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <FieldDescription>
                按 YP 批次整批预约；本期不支持在同一批次内单独勾选样本。
              </FieldDescription>
            </Field>
          ) : (
            <Field>
              <FieldLabel>关联样本</FieldLabel>
              <Input
                value={`${task?.taskSamples?.map((ts) => ts.sample.sampleName || "未命名").join("、") ?? ""}${task?.project?.projectNo ? ` · ${task.project.projectNo}` : ""}`}
                disabled
              />
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="experimentType">实验类型</FieldLabel>
            <Input
              id="experimentType"
              value={experimentType}
              onChange={(event) => {
                userTouchedExperimentType.current = true
                setExperimentType(event.target.value)
              }}
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
              defaultValue={dateInputValue(task?.plannedDate ?? initialPlannedDate)}
            />
            <FieldDescription>填写后任务直接进入已排期。</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>实验负责人</FieldLabel>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate">
                    {operatorId === UNASSIGNED
                      ? "未指派"
                      : operatorOptions.find((o) => o.id === operatorId)?.name ?? "未指派"}
                  </span>
                  <ChevronDown aria-hidden="true" className="h-4 w-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[min(92vw,320px)] p-1">
                <DropdownMenuCheckboxItem
                  checked={operatorId === UNASSIGNED}
                  onCheckedChange={() => setOperatorId(UNASSIGNED)}
                  onSelect={(event) => event.preventDefault()}
                >
                  未指派
                </DropdownMenuCheckboxItem>
                {operatorOptions.map((operator) => (
                  <DropdownMenuCheckboxItem
                    key={operator.id}
                    checked={operatorId === operator.id}
                    onCheckedChange={() => setOperatorId(operator.id)}
                    onSelect={(event) => event.preventDefault()}
                  >
                    {operator.name}
                    {operator.department ? ` · ${operator.department}` : ""}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </Field>
        </div>
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
