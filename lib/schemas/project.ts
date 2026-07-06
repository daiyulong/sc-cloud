import { z } from "zod"
import {
  ProjectStatus,
  ServiceLevel,
  type ProjectStatus as ProjectStatusValue,
  type ServiceLevel as ServiceLevelValue,
} from "@/lib/enums"
import {
  nullableDate,
  nullableNonNegativeInt,
  nullableString,
  optionalString,
  requiredString,
  statusListSchema,
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

/** 列表多选状态（见 statusListSchema）：URL 逗号分隔串 → 去重校验后的状态数组。 */
export const projectStatusListSchema = statusListSchema(projectStatusValues)

export const createProjectSchema = z.object({
  // 项目编号（委托单号）不在创建时填，由 PM 确认时录入；创建仅登记客户/服务等
  // 进度式收集：合同号/样本批次信息上游给定、建项目时未必知道，均可空（重构 §2.1/§5）
  contractNo: nullableString,
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
  // 创建即生成 1 个空样本批次（0 叶子）；批次信息可提前填，收样时核对/补齐。
  batchNo: nullableString,
  species: nullableString,
  tissueType: nullableString,
  sampleCount: nullableNonNegativeInt,
  experimentType: nullableString,
  transportCondition: nullableString,
})
export type CreateProjectInput = z.infer<typeof createProjectSchema>

export const updateProjectSchema = createProjectSchema
  .partial()
  .refine((value) => Object.keys(value).some((key) => value[key as keyof typeof value] !== undefined), {
    message: "至少提供一个要更新的字段",
  })
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>

export const confirmProjectSchema = z.object({
  // 项目编号（委托单号）留空：推迟到「样本登记接收之后、项目排期之前」填写（需求 2026-07）
  projectNo: nullableString,
  projectManagerId: nullableString,
  serviceLevel: serviceLevelSchema.optional(),
  priority: optionalString,
  expectedDeliveryDate: nullableDate,
})
export type ConfirmProjectInput = z.infer<typeof confirmProjectSchema>

/**
 * 补填合同编号与项目编号（需求 2026-07）：在预约实验之前填写，两者均必填。
 * 预约实验时若 projectNo 或 contractNo 缺失，后端返回特定错误码触发前端弹窗。
 */
export const fillContractNoSchema = z.object({
  contractNo: requiredString("请输入合同编号"),
  projectNo: requiredString("请输入项目编号（委托单号）"),
})
export type FillContractNoInput = z.infer<typeof fillContractNoSchema>

/** 兼容旧名（代码迁移用） */
export const fillProjectNoSchema = fillContractNoSchema
export type FillProjectNoInput = FillContractNoInput

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
  status: projectStatusListSchema,
  serviceLevel: serviceLevelSchema.optional(),
  salesOwnerId: optionalString,
  projectManagerId: optionalString,
  /** soon = 未来 7 个自然日内预计交付且未关闭 */
  due: z.enum(["soon"]).optional(),
  page: optionalString,
  limit: optionalString,
})
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>
