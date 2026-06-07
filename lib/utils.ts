import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 内部：把多种输入解析为有效 Date，无效返回 null */
function parseDate(date: Date | string | null | undefined): Date | null {
  if (!date) return null
  const d = date instanceof Date ? date : new Date(date)
  return isNaN(d.getTime()) ? null : d
}

/** 本地化日期（默认 yyyy/mm/dd 风格由 locale 决定） */
export function formatDate(
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = parseDate(date)
  if (!d) return "-"
  return d.toLocaleDateString("zh-CN", options)
}

/** 本地化日期 + 时间 */
export function formatDateTime(date: Date | string | null | undefined): string {
  const d = parseDate(date)
  if (!d) return "-"
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * 取本地自然日字符串 YYYY-MM-DD（用日期分量拼接，不走 UTC 截断）。
 * 禁止用 toISOString().split()（ESLint 强制），它按 UTC 截断会跨时区误差一天。
 */
export function toDateString(date: Date | string | null | undefined): string {
  const d = parseDate(date)
  if (!d) return ""
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** 今天的本地自然日字符串 */
export function todayString(): string {
  return toDateString(new Date())
}

/**
 * 截断到本地自然日 00:00（用于跨字段日期比较，规避 datetime 直比误杀；规格 §8）。
 */
export function toDateOnly(date: Date | string | null | undefined): Date | null {
  const d = parseDate(date)
  if (!d) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** 自然日比较：a<b 返回 -1，a==b 返回 0，a>b 返回 1；任一为空返回 null */
export function compareDateOnly(
  a: Date | string | null | undefined,
  b: Date | string | null | undefined
): number | null {
  const da = toDateOnly(a)
  const db = toDateOnly(b)
  if (!da || !db) return null
  const ta = da.getTime()
  const tb = db.getTime()
  return ta === tb ? 0 : ta < tb ? -1 : 1
}

/** 是否同一自然日 */
export function isSameDateOnly(
  a: Date | string | null | undefined,
  b: Date | string | null | undefined
): boolean {
  return compareDateOnly(a, b) === 0
}

/** searchParams 多值取首个（用于 page.tsx 解析 URL 查询参数） */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/** 相对时间（如「3 小时前」），用于时间线/列表 */
export function formatDistanceToNow(date: Date | string | null | undefined): string {
  const d = parseDate(date)
  if (!d) return "-"
  const diff = Date.now() - d.getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return "刚刚"
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} 分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.floor(hour / 24)
  if (day < 30) return `${day} 天前`
  return formatDate(d)
}
