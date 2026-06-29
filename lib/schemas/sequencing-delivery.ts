import { z } from "zod"
import { nullableString } from "@/lib/schemas/common"

/**
 * 登记测序交付（外包测序回数据）。文件经 multipart 单独传，此处只校验文本字段。
 * storageUrl 通用——科创云 / 阿里云 OSS 等任意数据存储链接，手动粘贴；空串归一为 null。
 * 「链接与附件至少一项」的约束在 service 层校验（schema 看不到文件）。
 */
export const createSequencingDeliverySchema = z.object({
  storageUrl: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().url("请输入合法的链接（含 http(s)://）").nullable().optional()
  ),
  note: nullableString,
})
export type CreateSequencingDeliveryInput = z.infer<typeof createSequencingDeliverySchema>
