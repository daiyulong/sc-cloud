/**
 * 业务枚举单一来源（as const + type）。
 * 值与 prisma/schema.prisma 的 enum 严格一致；业务代码从此处导入，不直接依赖 @prisma/client 的枚举，
 * 以便集中维护中文标签与避免散落硬编码。
 */

// ---------- 用户角色 ----------
export const UserRole = {
  admin: "admin",
  sales_owner: "sales_owner",
  project_manager: "project_manager",
  sample_receiver: "sample_receiver",
  lab_operator: "lab_operator",
  bioinfo_analyst: "bioinfo_analyst",
  viewer: "viewer",
} as const
export type UserRole = (typeof UserRole)[keyof typeof UserRole]

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: "系统管理员",
  sales_owner: "销售负责人",
  project_manager: "项目经理",
  sample_receiver: "样本接收员",
  lab_operator: "实验执行员",
  bioinfo_analyst: "生信分析员",
  viewer: "只读用户",
}

// ---------- 服务档次（驱动交付分支）----------
export const ServiceLevel = {
  qc: "qc",
  library: "library",
  run: "run",
  standard: "standard",
  advanced: "advanced",
} as const
export type ServiceLevel = (typeof ServiceLevel)[keyof typeof ServiceLevel]

export const SERVICE_LEVEL_LABELS: Record<ServiceLevel, string> = {
  qc: "质控",
  library: "建库",
  run: "上机测序",
  standard: "标准分析",
  advanced: "高级分析",
}

/** 服务档次是否需要生信分析（standard/advanced 经生信，其余实验完成直接待交付）。§7.1 */
export const BIOINFO_SERVICE_LEVELS: ServiceLevel[] = [
  ServiceLevel.standard,
  ServiceLevel.advanced,
]

// ---------- 项目状态 ----------
export const ProjectStatus = {
  draft: "draft",
  confirmed: "confirmed",
  waiting_sample: "waiting_sample",
  sample_received: "sample_received",
  lab_in_progress: "lab_in_progress",
  waiting_bioinfo: "waiting_bioinfo",
  bioinfo_in_progress: "bioinfo_in_progress",
  waiting_delivery: "waiting_delivery",
  delivered: "delivered",
  completed: "completed",
  abnormal: "abnormal",
  terminated: "terminated",
} as const
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus]

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "草稿",
  confirmed: "已确认",
  waiting_sample: "待到样",
  sample_received: "已到样",
  lab_in_progress: "实验中",
  waiting_bioinfo: "待生信",
  bioinfo_in_progress: "生信分析中",
  waiting_delivery: "待交付",
  delivered: "已交付",
  completed: "已完成",
  abnormal: "异常",
  terminated: "已终止",
}

// ---------- 样本状态 ----------
export const SampleStatus = {
  waiting_arrival: "waiting_arrival",
  received: "received",
  received_abnormal: "received_abnormal",
  waiting_task: "waiting_task",
  lab_in_progress: "lab_in_progress",
  feedback_submitted: "feedback_submitted",
  abnormal: "abnormal",
} as const
export type SampleStatus = (typeof SampleStatus)[keyof typeof SampleStatus]

export const SAMPLE_STATUS_LABELS: Record<SampleStatus, string> = {
  waiting_arrival: "待到样",
  received: "已接收",
  received_abnormal: "异常接收",
  waiting_task: "待实验任务",
  lab_in_progress: "实验中",
  feedback_submitted: "已反馈",
  abnormal: "异常",
}

// ---------- 实验任务状态 ----------
export const ExperimentTaskStatus = {
  waiting_schedule: "waiting_schedule",
  scheduled: "scheduled",
  in_progress: "in_progress",
  waiting_feedback: "waiting_feedback",
  completed: "completed",
  cancelled: "cancelled",
  abnormal: "abnormal",
} as const
export type ExperimentTaskStatus =
  (typeof ExperimentTaskStatus)[keyof typeof ExperimentTaskStatus]

export const EXPERIMENT_TASK_STATUS_LABELS: Record<ExperimentTaskStatus, string> = {
  waiting_schedule: "待排期",
  scheduled: "已排期",
  in_progress: "进行中",
  waiting_feedback: "待反馈",
  completed: "已完成",
  cancelled: "已取消",
  abnormal: "异常",
}

// ---------- 悬液类型：细胞/细胞核（scRNA vs snRNA，相似经验检索与统计维度，§6.8）----------
// 命名刻意避开 "CellType"：单细胞/空间转录组里 cell type 指细胞类型注释（T/B/上皮…），
// 与此处「上机悬液装完整细胞还是细胞核」是完全不同维度，留给将来的注释功能。
export const SuspensionType = {
  cell: "cell",
  nucleus: "nucleus",
} as const
export type SuspensionType = (typeof SuspensionType)[keyof typeof SuspensionType]

export const SUSPENSION_TYPE_LABELS: Record<SuspensionType, string> = {
  cell: "细胞",
  nucleus: "细胞核",
}

// ---------- 生信分析状态 ----------
export const BioinfoTaskStatus = {
  pending: "pending",
  in_progress: "in_progress",
  waiting_review: "waiting_review",
  waiting_delivery: "waiting_delivery",
  delivered: "delivered",
  abnormal: "abnormal",
} as const
export type BioinfoTaskStatus =
  (typeof BioinfoTaskStatus)[keyof typeof BioinfoTaskStatus]

export const BIOINFO_TASK_STATUS_LABELS: Record<BioinfoTaskStatus, string> = {
  pending: "待开始",
  in_progress: "分析中",
  waiting_review: "待审核",
  waiting_delivery: "待交付",
  delivered: "已交付",
  abnormal: "异常",
}

// ---------- 样本接收状态（执行态）----------
export const ReceiveStatus = {
  normal: "normal",
  abnormal: "abnormal",
} as const
export type ReceiveStatus = (typeof ReceiveStatus)[keyof typeof ReceiveStatus]

export const RECEIVE_STATUS_LABELS: Record<ReceiveStatus, string> = {
  normal: "正常",
  abnormal: "异常",
}

// ---------- 质控结论（业务判定态）----------
export const QCResult = {
  passed: "passed",
  low_risk_passed: "low_risk_passed",
  failed: "failed",
} as const
export type QCResult = (typeof QCResult)[keyof typeof QCResult]

export const QC_RESULT_LABELS: Record<QCResult, string> = {
  passed: "通过",
  low_risk_passed: "低风险通过",
  failed: "不通过",
}

// ---------- 风险等级 ----------
export const RiskLevel = {
  normal: "normal",
  low_risk: "low_risk",
  high_risk: "high_risk",
} as const
export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel]

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  normal: "正常",
  low_risk: "低风险",
  high_risk: "高风险",
}

// ---------- 实验结果状态（业务判定态）----------
export const ResultStatus = {
  normal_run: "normal_run",
  low_risk_run: "low_risk_run",
  not_qualified: "not_qualified",
  other: "other",
} as const
export type ResultStatus = (typeof ResultStatus)[keyof typeof ResultStatus]

export const RESULT_STATUS_LABELS: Record<ResultStatus, string> = {
  normal_run: "正常上机",
  low_risk_run: "低风险上机",
  not_qualified: "不满足要求",
  other: "其他",
}

// ---------- 操作日志动作 ----------
export const OperationAction = {
  create: "create",
  update: "update",
  status_change: "status_change",
  assign: "assign",
  import: "import",
  delete: "delete",
} as const
export type OperationAction = (typeof OperationAction)[keyof typeof OperationAction]
