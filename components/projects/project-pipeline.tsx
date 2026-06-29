import * as React from "react"
import { Check } from "lucide-react"
import {
  BIOINFO_SERVICE_LEVELS,
  ProjectStatus,
  type ProjectStatus as ProjectStatusValue,
  type ServiceLevel as ServiceLevelValue,
} from "@/lib/enums"
import { cn } from "@/lib/utils"

type Stage = { key: ProjectStatusValue; label: string }

// 生命周期阶段：service_level 驱动两条交付路径（§7.1）——standard/advanced 经生信，
// qc/library/run 实验完成直接待交付（跳过待生信 / 生信分析中两态）。
const BASE_STAGES: Stage[] = [
  { key: ProjectStatus.draft, label: "草稿" },
  { key: ProjectStatus.waiting_sample, label: "待到样" },
  { key: ProjectStatus.sample_received, label: "已到样" },
  { key: ProjectStatus.lab_in_progress, label: "实验" },
]
const BIOINFO_STAGES: Stage[] = [
  { key: ProjectStatus.waiting_bioinfo, label: "待生信" },
  { key: ProjectStatus.bioinfo_in_progress, label: "生信" },
]
const TAIL_STAGES: Stage[] = [
  { key: ProjectStatus.waiting_delivery, label: "待交付" },
  { key: ProjectStatus.completed, label: "完成" },
]

type ProjectPipelineProps = {
  status: ProjectStatusValue
  serviceLevel: ServiceLevelValue
  /** 异常/终止时的出事前状态：用于在离线态下仍显示真实进度（走到哪步才中断） */
  statusBeforeAbnormal?: ProjectStatusValue | null
}

/**
 * 项目生命周期进度条：把状态机在详情页可视化。纯展示，按 status + service_level 渲染。
 * 异常 / 终止为离线态：按 `statusBeforeAbnormal` 显示走到哪——之前的步骤已完成、
 * 中断步标红、其后置灰（无出事前状态时整链置灰兜底）；离线态名称由顶栏状态徽章承载。
 */
export function ProjectPipeline({
  status,
  serviceLevel,
  statusBeforeAbnormal,
}: ProjectPipelineProps) {
  const withBio = BIOINFO_SERVICE_LEVELS.includes(serviceLevel)
  const stages = withBio
    ? [...BASE_STAGES, ...BIOINFO_STAGES, ...TAIL_STAGES]
    : [...BASE_STAGES, ...TAIL_STAGES]
  const offFlow =
    status === ProjectStatus.abnormal || status === ProjectStatus.terminated
  const curIdx = stages.findIndex((stage) => stage.key === status)
  // 离线态下中断点 = 出事前所在步；之前算已完成、该步标红、其后置灰
  const breakIdx =
    offFlow && statusBeforeAbnormal
      ? stages.findIndex((stage) => stage.key === statusBeforeAbnormal)
      : -1
  const progressIdx = offFlow ? breakIdx : curIdx

  return (
    <div className="flex items-center overflow-x-auto rounded-lg border bg-card px-4 py-4">
      {stages.map((stage, i) => {
        const done = i < progressIdx
        const cur = !offFlow && i === curIdx
        const broke = offFlow && i === breakIdx
        return (
          <React.Fragment key={stage.key}>
            <div className="flex shrink-0 flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[11px] font-semibold",
                  broke
                    ? "bg-destructive text-white"
                    : cur
                      ? "bg-primary text-primary-foreground"
                      : done
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-[11px]",
                  broke
                    ? "font-medium text-destructive"
                    : cur
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                )}
              >
                {stage.label}
              </span>
            </div>
            {i < stages.length - 1 && (
              <span
                className={cn(
                  "mb-5 h-0.5 min-w-[16px] flex-1",
                  i < progressIdx ? "bg-primary/30" : "bg-border"
                )}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
