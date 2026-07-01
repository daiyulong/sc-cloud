import Link from "next/link"
import {
  PROJECT_STATUS_LABELS,
  SampleBatchStatus,
  SAMPLE_BATCH_STATUS_LABELS,
  SAMPLE_STATUS_LABELS,
  type ProjectStatus as ProjectStatusValue,
  type SampleBatchStatus as SampleBatchStatusValue,
  type SampleStatus as SampleStatusValue,
} from "@/lib/enums"
import type { getSampleDetail } from "@/lib/samples/service"
import { canActAsStaff } from "@/lib/auth/action-roles"
import { formatDate, formatDateTime, toDateString } from "@/lib/utils"
import { EditableSection } from "@/components/detail/editable-section"
import { WorkItemHeader } from "@/components/detail/work-item-header"
import { SampleReceiveForm } from "@/components/samples/sample-receive-form"
import { SampleActionMenu } from "@/components/samples/sample-action-menu"
import { sampleReceivableProjectStatuses } from "@/lib/samples/rules"
import { SAMPLE_STATUS_DOT } from "@/components/status-dot"

type SampleDetail = Awaited<ReturnType<typeof getSampleDetail>>

export function SampleWorkItemBody({
  detail,
  role,
}: {
  detail: SampleDetail
  role?: string
}) {
  const { sample } = detail
  const status = sample.status as SampleBatchStatusValue
  const project = sample.project
  const projectStatus = project.status as ProjectStatusValue
  const editable = canActAsStaff(role)
  const endpoint = `/api/samples/${sample.id}`
  const samplingDateValue = toDateString(sample.samplingDate)
  const expectedArrivalDateValue = toDateString(sample.expectedArrivalDate)
  const leafSummary =
    sample.samples.length === 0
      ? "-"
      : sample.samples
          .map(
            (s) =>
              `${s.sampleName || "未命名"}（${SAMPLE_STATUS_LABELS[s.status as SampleStatusValue]}）`,
          )
          .join("、")
  const sampleInfoFields = [
    {
      name: "batchNo",
      label: "样品编号 (YP)",
      value: sample.batchNo,
      placeholder: "YP-xxxx…",
    },
    {
      name: "species",
      label: "样本物种",
      value: sample.species,
      placeholder: "人 / 小鼠 / 大鼠…",
    },
    {
      name: "tissueType",
      label: "组织类型",
      value: sample.tissueType,
      placeholder: "肺组织 / 肝脏组织…",
    },
    {
      name: "sampleCount",
      label: "样本数量",
      value: sample.sampleCount,
      type: "number" as const,
      placeholder: "1…",
    },
    {
      name: "experimentType",
      label: "实验类型",
      value: sample.experimentType,
      placeholder: "组织解离 / 建库 / 上机…",
    },
    {
      name: "transportCondition",
      label: "运输条件",
      value: sample.transportCondition,
      placeholder: "4℃ / 冷链 / 干冰…",
    },
    {
      name: "samplingDate",
      label: "客户取样日期",
      value: samplingDateValue,
      displayValue: samplingDateValue ? formatDate(sample.samplingDate) : null,
      type: "date" as const,
    },
    {
      name: "expectedArrivalDate",
      label: "预计到样日期",
      value: expectedArrivalDateValue,
      displayValue: expectedArrivalDateValue ? formatDate(sample.expectedArrivalDate) : null,
      type: "date" as const,
    },
    {
      name: "receivedAt",
      label: "实际接收时间",
      displayValue: formatDateTime(sample.receivedAt),
      editable: false,
    },
    {
      name: "receiver",
      label: "接收人",
      displayValue: sample.receiver?.name,
      editable: false,
    },
    {
      name: "abnormalNote",
      label: "异常说明",
      displayValue: sample.abnormalNote,
      editable: false,
      multiline: true,
    },
    {
      name: "createdAt",
      label: "创建时间",
      displayValue: formatDateTime(sample.createdAt),
      editable: false,
    },
    {
      name: "leafSummary",
      label: `样本（${sample.samples.length}）`,
      displayValue: leafSummary,
      editable: false,
      multiline: true,
      span: "full" as const,
    },
    {
      name: "remark",
      label: "备注",
      value: sample.remark,
      type: "textarea" as const,
      placeholder: "补充样本说明…",
      multiline: true,
      span: "full" as const,
    },
  ]

  const isWaitingArrival = status === SampleBatchStatus.waiting_arrival
  const isAbnormalBatch = status === SampleBatchStatus.received_abnormal
  const canReceiveSample =
    isWaitingArrival && sampleReceivableProjectStatuses.includes(projectStatus)

  return (
    <>
      <WorkItemHeader
        title={sample.batchNo ?? "未编号批次"}
        statusLabel={SAMPLE_BATCH_STATUS_LABELS[status]}
        statusDotClassName={SAMPLE_STATUS_DOT[status]}
        project={{
          id: project.id,
          projectNo: project.projectNo,
          customerOrg: project.customerOrg,
          statusLabel: PROJECT_STATUS_LABELS[projectStatus],
        }}
        actionMenu={
          <SampleActionMenu
            sampleId={sample.id}
            sampleNo={sample.batchNo ?? "未编号批次"}
            status={status}
            projectStatus={projectStatus}
            role={role}
          />
        }
      />

      {canReceiveSample ? (
        <SampleReceiveForm
          key={sample.id}
          endpoint={`/api/samples/${sample.id}/receive`}
          sampleNo={sample.batchNo ?? "未编号批次"}
          batchNo={sample.batchNo}
          projectId={sample.project.id}
          projectNo={sample.project.projectNo ?? undefined}
          expectedArrival={formatDate(sample.expectedArrivalDate)}
          species={sample.species}
          tissueType={sample.tissueType}
          experimentType={sample.experimentType}
          transportCondition={sample.transportCondition}
          sampleCount={sample.sampleCount}
        />
      ) : (
        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-5">
            {isWaitingArrival && (
              <div className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-300">
                当前项目为{PROJECT_STATUS_LABELS[projectStatus]}，不能登记样本接收。请先回项目工位确认项目；确认后该批次才会进入收样队列。
              </div>
            )}
            {isAbnormalBatch && (
              <div className="rounded-md border border-orange-200 bg-orange-50/60 px-3 py-2 text-sm text-orange-800 dark:border-orange-900/60 dark:bg-orange-950/25 dark:text-orange-300">
                该批次已被标记异常接收。后续流转仅在该批次内进行，不推进项目状态；如需重做请创建新批次。
              </div>
            )}
            <EditableSection
              title="修正信息"
              endpoint={endpoint}
              fields={sampleInfoFields}
              editable={editable}
              editLabel="修正"
              successMessage="批次信息已保存"
            />
          </div>
        </main>
      )}
    </>
  )
}
