import Link from "next/link"
import type { getBioinfoTaskDetail } from "@/lib/bioinfo-tasks/service"
import { formatDate, formatDateTime } from "@/lib/utils"
import { FieldLine } from "@/components/detail/field-line"

type BioinfoTaskEntity = Awaited<ReturnType<typeof getBioinfoTaskDetail>>["task"]

/** 生信任务核心字段网格（全页 3 列 / 侧滑 2 列共用） */
export function BioinfoTaskFields({
  task,
  columns = 3,
}: {
  task: BioinfoTaskEntity
  columns?: 2 | 3
}) {
  const gridClass = columns === 3 ? "grid gap-5 md:grid-cols-3" : "grid grid-cols-2 gap-4"
  const spanClass = columns === 3 ? "md:col-span-3" : "col-span-2"

  return (
    <div className={gridClass}>
      <FieldLine
        label="关联实验任务"
        value={
          <Link href={`/experiment-tasks/${task.experimentTask.id}`} className="hover:underline">
            {task.experimentTask.taskNo}
          </Link>
        }
      />
      <FieldLine label="分析类型" value={task.analysisType} />
      <FieldLine label="分析负责人" value={task.analyst?.name} />
      <FieldLine label="数据接收日期" value={formatDate(task.dataReceivedAt)} />
      <FieldLine label="报告交付日期" value={formatDate(task.deliveredAt)} />
      <FieldLine label="创建时间" value={formatDateTime(task.createdAt)} />
      <div className={spanClass}>
        <FieldLine label="交付物说明" value={task.deliverableNote} />
      </div>
      <div className={spanClass}>
        <FieldLine label="备注" value={task.remark} />
      </div>
    </div>
  )
}
