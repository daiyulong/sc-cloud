import Link from "next/link"
import * as React from "react"
import { StatusDot } from "@/components/status-dot"

/**
 * 工作项面板的页头：编号 + 状态彩点/标签 + 项目元信息；可选右侧操作菜单。
 * 由 WorkItemPanel 内的三个 body 复用；右侧自动留出 Sheet 内置关闭按钮的位置（pr-14）。
 */
export type WorkItemHeaderProps = {
  title: string
  statusLabel: string
  /** Status 彩点 className（来自 *STATUS_DOT 表） */
  statusDotClassName?: string
  project: {
    id: string
    projectNo: string | null
    customerOrg: string
    statusLabel: string
  }
  /** 右侧操作菜单（如 SampleActionMenu / BioinfoTaskActionMenu） */
  actionMenu?: React.ReactNode
}

export function WorkItemHeader({
  title,
  statusLabel,
  statusDotClassName,
  project,
  actionMenu,
}: WorkItemHeaderProps) {
  return (
    <header className="flex shrink-0 items-start justify-between gap-4 border-b px-6 py-5 pr-14">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="break-words text-lg font-semibold">{title}</h2>
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {statusDotClassName ? <StatusDot className={statusDotClassName} /> : null}
            {statusLabel}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          <Link href={`/projects/${project.id}`} className="hover:underline">
            {project.projectNo}
          </Link>{" "}
          · {project.customerOrg} · {project.statusLabel}
        </p>
      </div>
      {actionMenu ? (
        <div className="flex shrink-0 items-start gap-2">{actionMenu}</div>
      ) : null}
    </header>
  )
}
