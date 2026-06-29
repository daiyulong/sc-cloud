import Link from "next/link"
import { ChevronRight } from "lucide-react"

type DetailBreadcrumbProps = {
  /** 上级列表路径 */
  backHref: string
  /** 上级列表名 */
  backLabel: string
  /** 当前条目标识（编号等） */
  current: string
}

/**
 * 详情全页顶部面包屑：上级列表 / 当前条目。
 * 配合常驻侧栏构成 Vercel 式回退（见 ADR-0002，详情整页化）。
 */
export function DetailBreadcrumb({ backHref, backLabel, current }: DetailBreadcrumbProps) {
  return (
    <nav aria-label="面包屑" className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Link href={backHref} className="transition-colors hover:text-foreground">
        {backLabel}
      </Link>
      <ChevronRight className="size-3.5 opacity-60" aria-hidden="true" />
      <span className="font-medium text-foreground">{current}</span>
    </nav>
  )
}
