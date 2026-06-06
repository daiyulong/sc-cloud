import { USER_ROLE_LABELS, type UserRole as UserRoleValue } from "@/lib/enums"
import { formatDateTime } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

type TimelineLog = {
  id: string
  action: string
  createdAt: Date | string
  operator: { name: string | null; role: string }
}

/** 操作日志时间线（项目/样本详情共用） */
export function OperationTimeline({ logs }: { logs: TimelineLog[] }) {
  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无操作日志。</p>
  }
  return (
    <div className="flex flex-col gap-4">
      {logs.map((log) => (
        <div key={log.id} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{log.action}</Badge>
              <span className="text-sm font-medium">{log.operator.name}</span>
              <span className="text-xs text-muted-foreground">
                {USER_ROLE_LABELS[log.operator.role as UserRoleValue]}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {formatDateTime(log.createdAt)}
            </span>
          </div>
          <Separator />
        </div>
      ))}
    </div>
  )
}
