import Link from "next/link"
import { Button } from "@/components/ui/button"

type ListPagerProps = {
  total: number
  page: number
  totalPages: number
  /** 计数行的实体量词，如 "项目" / "任务" / "样本" */
  noun: string
  hrefFor: (page: number) => string
}

/**
 * 列表页脚：左「共 N 个X · 第 P/T 页」+ 右上一页/下一页。各列表工位共用。
 * total 为 0 时不渲染（调用方无需再包 `{total > 0 && ...}`）。
 */
export function ListPager({ total, page, totalPages, noun, hrefFor }: ListPagerProps) {
  if (total === 0) return null
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">
        共 {total} 个{noun} · 第 {page} / {totalPages} 页
      </p>
      <div className="flex items-center gap-2">
        {page <= 1 ? (
          <Button variant="outline" size="sm" disabled>
            上一页
          </Button>
        ) : (
          <Button variant="outline" size="sm" asChild>
            <Link href={hrefFor(page - 1)}>上一页</Link>
          </Button>
        )}
        {page >= totalPages ? (
          <Button variant="outline" size="sm" disabled>
            下一页
          </Button>
        ) : (
          <Button variant="outline" size="sm" asChild>
            <Link href={hrefFor(page + 1)}>下一页</Link>
          </Button>
        )}
      </div>
    </div>
  )
}
