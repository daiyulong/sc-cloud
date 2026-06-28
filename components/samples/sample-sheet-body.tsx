import Link from "next/link"
import { Edit, Maximize2 } from "lucide-react"
import {
  PROJECT_STATUS_LABELS,
  SAMPLE_BATCH_STATUS_LABELS,
  type ProjectStatus as ProjectStatusValue,
  type SampleBatchStatus as SampleBatchStatusValue,
} from "@/lib/enums"
import type { getSampleDetail } from "@/lib/samples/service"
import { OperationTimeline } from "@/components/detail/operation-timeline"
import { SampleActionMenu } from "@/components/samples/sample-action-menu"
import { SampleFields } from "@/components/samples/sample-fields"
import { SAMPLE_STATUS_DOT, StatusDot } from "@/components/status-dot"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

type SampleDetail = Awaited<ReturnType<typeof getSampleDetail>>

/** 侧滑详情内容（server 渲染）：头部 + 动作 + 核心字段 + 时间线 */
export function SampleSheetBody({ detail, role }: { detail: SampleDetail; role?: string }) {
  const { sample, operationLogs } = detail
  const status = sample.status as SampleBatchStatusValue

  return (
    <div className="flex flex-col gap-5 p-6">
      <header className="flex flex-col gap-2 pr-8">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{sample.batchNo ?? "未编号批次"}</h2>
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <StatusDot className={SAMPLE_STATUS_DOT[status]} />
            {SAMPLE_BATCH_STATUS_LABELS[status]}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/projects/${sample.project.id}`} className="hover:underline">
            {sample.project.projectNo}
          </Link>{" "}
          · {sample.project.customerOrg} ·{" "}
          {PROJECT_STATUS_LABELS[sample.project.status as ProjectStatusValue]}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <SampleActionMenu
          sampleId={sample.id}
          sampleNo={sample.batchNo ?? "未编号批次"}
          status={status}
          role={role}
          showEmptyHint
        />
        <div className="ml-auto flex items-center gap-1.5">
          {/* 原生 <a> 硬导航绕过拦截，直达全页 */}
          <Button variant="ghost" size="icon-sm" asChild>
            <a href={`/samples/${sample.id}`} aria-label="在全页中打开">
              <Maximize2 aria-hidden="true" />
            </a>
          </Button>
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={`/samples/${sample.id}/edit`} aria-label="编辑样本">
              <Edit aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>

      <Separator />
      <SampleFields sample={sample} columns={2} />
      <Separator />

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">时间线</h3>
        <OperationTimeline logs={operationLogs} />
      </section>
    </div>
  )
}
