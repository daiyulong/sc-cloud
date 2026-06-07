import { USER_ROLE_LABELS, type UserRole as UserRoleValue } from "@/lib/enums"
import { describeOperationLog } from "@/lib/operation-log-describe"
import { formatDateTime } from "@/lib/utils"

type TimelineLog = {
  id: string
  entityType: string
  action: string
  beforeData?: unknown
  afterData?: unknown
  createdAt: Date | string
  operator: { name: string | null; role: string }
}

/**
 * 操作日志时间线（项目/样本/实验/生信详情共用）。
 * 左侧轨道 + 圆点，每条翻译成「动作 + 状态转移」，项目时间线已聚合子实体事件。
 */
export function OperationTimeline({ logs }: { logs: TimelineLog[] }) {
  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无操作日志。</p>
  }
  return (
    <ol className="flex flex-col">
      {logs.map((log, index) => {
        const { title, transition } = describeOperationLog(log)
        const roleLabel = USER_ROLE_LABELS[log.operator.role as UserRoleValue] ?? log.operator.role
        const isLast = index === logs.length - 1
        return (
          <li key={log.id} className="relative flex gap-3 pb-4 last:pb-0">
            {/* 轨道：圆点 + 连接线 */}
            <div className="flex flex-col items-center">
              <span className="mt-1 size-2 shrink-0 rounded-full bg-foreground/40" aria-hidden="true" />
              {!isLast && <span className="w-px flex-1 bg-border" aria-hidden="true" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-sm font-medium">{title}</span>
                <time className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatDateTime(log.createdAt)}
                </time>
              </div>
              {transition && (
                <span className="text-xs text-muted-foreground">{transition}</span>
              )}
              <span className="text-xs text-muted-foreground">
                {log.operator.name ?? "—"} · {roleLabel}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
