import type { getProjectDetail } from "@/lib/projects/service"
import {
  SERVICE_LEVEL_LABELS,
  type ServiceLevel as ServiceLevelValue,
} from "@/lib/enums"
import { formatDate, formatDateTime } from "@/lib/utils"
import { FieldLine } from "@/components/detail/field-line"

type ProjectDetailEntity = Awaited<ReturnType<typeof getProjectDetail>>["project"]

/** 项目核心字段网格（全页 3 列 / 紧凑区块 2 列共用） */
export function ProjectFields({
  project,
  columns = 3,
}: {
  project: ProjectDetailEntity
  columns?: 2 | 3
}) {
  const gridClass =
    columns === 3 ? "grid gap-5 md:grid-cols-3" : "grid grid-cols-2 gap-4"
  const spanClass = columns === 3 ? "md:col-span-3" : "col-span-2"

  return (
    <div className={gridClass}>
      <FieldLine label="合同编号" value={project.contractNo} />
      <FieldLine
        label="服务档次"
        value={SERVICE_LEVEL_LABELS[project.serviceLevel as ServiceLevelValue]}
      />
      <FieldLine label="项目类型" value={project.projectType} />
      <FieldLine label="服务内容" value={project.serviceItems} />
      <FieldLine label="优先级" value={project.priority} />
      <FieldLine label="销售负责人" value={project.salesOwner?.name} />
      <FieldLine label="项目经理" value={project.projectManager?.name} />
      <FieldLine label="预计交付" value={formatDate(project.expectedDeliveryDate)} />
      <FieldLine label="测序平台" value={project.sequencingPlatform} />
      <FieldLine label="实际交付" value={formatDateTime(project.deliveredAt)} />
      <FieldLine label="创建时间" value={formatDateTime(project.createdAt)} />
      <div className={spanClass}>
        <FieldLine label="备注" value={project.remark} />
      </div>
    </div>
  )
}
