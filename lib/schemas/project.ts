import { z } from "zod"
import {
  ProjectStatus,
  ServiceLevel,
  type ProjectStatus as ProjectStatusValue,
  type ServiceLevel as ServiceLevelValue,
} from "@/lib/enums"
import {
  nullableDate,
  nullableString,
  optionalString,
  requiredString,
} from "@/lib/schemas/common"

const serviceLevelValues = Object.values(ServiceLevel) as [
  ServiceLevelValue,
  ...ServiceLevelValue[],
]
const projectStatusValues = Object.values(ProjectStatus) as [
  ProjectStatusValue,
  ...ProjectStatusValue[],
]

export const serviceLevelSchema = z.enum(serviceLevelValues)
export const projectStatusSchema = z.enum(projectStatusValues)

export const createProjectSchema = z.object({
  // 项目编号（委托单号）不在创建时填，由 PM 确认时录入；创建仅登记客户/合同/服务等
  contractNo: requiredString("请输入合同编号"),
  customerOrg: requiredString("请输入客户单位"),
  customerName: requiredString("请输入客户姓名"),
  customerContact: nullableString,
  salesOwnerId: nullableString,
  projectManagerId: nullableString,
  projectType: requiredString("请输入项目类型"),
  serviceItems: requiredString("请输入服务内容"),
  serviceLevel: serviceLevelSchema,
  sequencingPlatform: nullableString,
  priority: z.string().trim().min(1).default("普通"),
  expectedDeliveryDate: nullableDate,
  remark: nullableString,
  // 一委托单一组样本：销售建项目时填 样本编号(YP) + 样本数量，创建即生成 1 条待到样样本
  sampleNo: requiredString("请输入样本编号"),
  sampleCount: z.preprocess(
    (value) => (typeof value === "string" ? Number(value) : value),
    z.number("样本数量必须为数字").int("样本数量必须为整数").positive("样本数量至少为 1")
  ),
})
export type CreateProjectInput = z.infer<typeof createProjectSchema>

export const updateProjectSchema = createProjectSchema
  .partial()
  .refine((value) => Object.keys(value).some((key) => value[key as keyof typeof value] !== undefined), {
    message: "至少提供一个要更新的字段",
  })
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>

export const confirmProjectSchema = z.object({
  // 项目编号（委托单号）= 上游给定，PM 确认时录入并校验唯一
  projectNo: requiredString("请输入项目编号（委托单号）"),
  projectManagerId: nullableString,
  serviceLevel: serviceLevelSchema.optional(),
  priority: optionalString,
  expectedDeliveryDate: nullableDate,
})
export type ConfirmProjectInput = z.infer<typeof confirmProjectSchema>

export const projectReasonSchema = z.object({
  reason: requiredString("请输入原因").max(1000, "原因最多 1000 字"),
})
export type ProjectReasonInput = z.infer<typeof projectReasonSchema>

export const optionalProjectReasonSchema = z.object({
  reason: optionalString,
})
export type OptionalProjectReasonInput = z.infer<typeof optionalProjectReasonSchema>

export const deliverProjectSchema = z.object({
  deliveredAt: nullableDate,
})
export type DeliverProjectInput = z.infer<typeof deliverProjectSchema>

export const projectListQuerySchema = z.object({
  q: optionalString,
  status: projectStatusSchema.optional(),
  serviceLevel: serviceLevelSchema.optional(),
  salesOwnerId: optionalString,
  projectManagerId: optionalString,
  /** soon = 未来 7 个自然日内预计交付且未关闭（工作台「7 天内交付」入口） */
  due: z.enum(["soon"]).optional(),
  /** 交付队列默认范围：无显式 status 时圈定「待交付 + 已交付」（仅 /delivery 内部设置） */
  deliveryScope: z.boolean().optional(),
  page: optionalString,
  limit: optionalString,
})
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>
