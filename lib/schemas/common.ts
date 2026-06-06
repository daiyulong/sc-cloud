import { z } from "zod"

/**
 * 表单/API 入参的零碎预处理（框架级工具，各业务 schema 共用）。
 * 约定：空字符串视为「未填」——optional 场景转 undefined，nullable 场景转 null。
 */

export const requiredString = (message: string) => z.string().trim().min(1, message)

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
