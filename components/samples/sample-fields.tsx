import type { getSampleDetail } from "@/lib/samples/service"
import { SAMPLE_STATUS_LABELS, type SampleStatus as SampleStatusValue } from "@/lib/enums"
import { formatDate, formatDateTime } from "@/lib/utils"
import { FieldLine } from "@/components/detail/field-line"

// 注：重构后「样本」详情实体为 SampleBatch（样本批次/YP），含其样本叶子 samples[]
type SampleDetailEntity = Awaited<ReturnType<typeof getSampleDetail>>["sample"]

/** 样本批次核心字段网格（全页 3 列 / 侧滑 2 列共用） */
export function SampleFields({
  sample,
  columns = 3,
}: {
  sample: SampleDetailEntity
  columns?: 2 | 3
}) {
  const gridClass =
    columns === 3 ? "grid gap-5 md:grid-cols-3" : "grid grid-cols-2 gap-4"
  const spanClass = columns === 3 ? "md:col-span-3" : "col-span-2"

  const leafSummary =
    sample.samples.length === 0
      ? "-"
      : sample.samples
          .map((s) => `${s.sampleName || "未命名"}（${SAMPLE_STATUS_LABELS[s.status as SampleStatusValue]}）`)
          .join("、")

  return (
    <div className={gridClass}>
      <FieldLine label="样本编号 (YP)" value={sample.batchNo ?? "未编号"} />
      <FieldLine label="样本物种" value={sample.species} />
      <FieldLine label="组织类型" value={sample.tissueType} />
      <FieldLine label="样本数量" value={sample.sampleCount ?? "-"} />
      <FieldLine label="实验类型" value={sample.experimentType} />
      <FieldLine label="运输条件" value={sample.transportCondition} />
      <FieldLine label="客户取样日期" value={formatDate(sample.samplingDate)} />
      <FieldLine label="预计到样日期" value={formatDate(sample.expectedArrivalDate)} />
      <FieldLine label="实际接收时间" value={formatDateTime(sample.receivedAt)} />
      <FieldLine label="接收人" value={sample.receiver?.name} />
      <FieldLine label="异常说明" value={sample.abnormalNote} />
      <FieldLine label="创建时间" value={formatDateTime(sample.createdAt)} />
      <div className={spanClass}>
        <FieldLine label={`样本（${sample.samples.length}）`} value={leafSummary} />
      </div>
      <div className={spanClass}>
        <FieldLine label="备注" value={sample.remark} />
      </div>
    </div>
  )
}
