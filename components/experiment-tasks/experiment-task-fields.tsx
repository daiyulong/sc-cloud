import type { getExperimentTaskDetail } from "@/lib/experiment-tasks/service"
import {
  RESULT_STATUS_LABELS,
  type ResultStatus as ResultStatusValue,
} from "@/lib/enums"
import { formatDate, formatDateTime } from "@/lib/utils"
import { FieldLine } from "@/components/detail/field-line"

type ExperimentTaskEntity = Awaited<ReturnType<typeof getExperimentTaskDetail>>["task"]

/** 实验任务核心字段网格（全页 3 列 / 侧滑 2 列共用） */
export function ExperimentTaskFields({
  task,
  columns = 3,
}: {
  task: ExperimentTaskEntity
  columns?: 2 | 3
}) {
  const gridClass = columns === 3 ? "grid gap-5 md:grid-cols-3" : "grid grid-cols-2 gap-4"
  const spanClass = columns === 3 ? "md:col-span-3" : "col-span-2"

  const leaves = task.taskSamples.map((ts) => ts.sample)
  const first = leaves[0]
  const sampleNames = leaves.map((s) => s.sampleName || "未命名").join("、") || "-"

  return (
    <div className={gridClass}>
      <FieldLine label="关联样本" value={sampleNames} />
      <FieldLine
        label="物种 / 组织"
        value={first ? `${first.species ?? "-"} · ${first.tissueType ?? "-"}` : "-"}
      />
      <FieldLine label="实验类型" value={task.experimentType} />
      <FieldLine label="上机方式" value={task.runMethod} />
      <FieldLine label="计划实验日期" value={formatDate(task.plannedDate)} />
      <FieldLine label="实际实验日期" value={formatDate(task.actualDate)} />
      <FieldLine label="实验负责人" value={task.operator?.name} />
      <FieldLine label="所属部门" value={task.department} />
      <FieldLine label="上机样本个数" value={task.taskSamples.length} />
      <FieldLine
        label="结果状态"
        value={task.resultStatus ? RESULT_STATUS_LABELS[task.resultStatus as ResultStatusValue] : "-"}
      />
      <FieldLine label="创建时间" value={formatDateTime(task.createdAt)} />
      <div className={spanClass}>
        <FieldLine label="结果反馈" value={task.resultFeedback} />
      </div>
    </div>
  )
}
