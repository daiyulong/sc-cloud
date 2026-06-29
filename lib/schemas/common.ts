import { z } from "zod"

/**
 * 表单/API 入参的零碎预处理（框架级工具，各业务 schema 共用）。
 * 约定：空字符串视为「未填」——optional 场景转 undefined，nullable 场景转 null。
 */

export const requiredString = (message: string) => z.string().trim().min(1, message)

/**
 * 列表多选状态筛选：URL 逗号分隔串 → 去重校验后的状态数组（非法值丢弃，空则 undefined）。
 * 单值串（旧链接 ?status=completed）天然兼容，解析为 1 元素数组。各实体列表共用。
 */
export function statusListSchema<T extends string>(values: readonly T[]) {
  const valid = new Set(values as readonly string[])
  return z
    .string()
    .transform((val) => {
      const picked = [
        ...new Set(val.split(",").map((s) => s.trim()).filter((s) => valid.has(s))),
      ] as T[]
      return picked.length ? picked : undefined
    })
    .optional()
}

export const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().optional()
)

export const nullableString = z.preprocess((value) => {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed === "" ? null : trimmed
  }
  return value
}, z.string().trim().nullable().optional())

export const nullableDate = z.preprocess((value) => {
  if (value === undefined) return undefined
  if (value === null || value === "") return null
  if (value instanceof Date) return value
  if (typeof value === "string") {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date
  }
  return value
}, z.date("日期格式不正确").nullable().optional())

/** 非负整数，允许为空（未填不等于 0，规格 §8.3） */
export const nullableNonNegativeInt = z.preprocess(
  (value) => {
    if (value === undefined) return undefined
    if (value === null || value === "") return null
    if (typeof value === "string") {
      const num = Number(value)
      return Number.isNaN(num) ? value : num
    }
    return value
  },
  z
    .number("必须为数字")
    .int("必须为整数")
    .nonnegative("不能为负数")
    .nullable()
    .optional()
)

/** 内部：把空串/空值归一为 null，字符串尝试转数字 */
function preprocessNullableNumber(value: unknown) {
  if (value === undefined) return undefined
  if (value === null || value === "") return null
  if (typeof value === "string") {
    const num = Number(value)
    return Number.isNaN(num) ? value : num
  }
  return value
}

/** 非负数（允许小数，如悬液浓度），允许为空 */
export const nullableNonNegativeNumber = z.preprocess(
  preprocessNullableNumber,
  z.number("必须为数字").nonnegative("不能为负数").nullable().optional()
)

/** 0-100 百分比（活率 / 结团率，规格 §8.4），允许为空 */
export const nullablePercent = z.preprocess(
  preprocessNullableNumber,
  z.number("必须为数字").min(0, "不能小于 0").max(100, "不能大于 100").nullable().optional()
)
