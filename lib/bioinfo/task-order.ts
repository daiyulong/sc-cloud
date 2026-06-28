import { prisma } from "@/lib/prisma"
import { buildProjectScope } from "@/lib/auth/role-scope"
import { SERVICE_LEVEL_LABELS, type ServiceLevel, type UserRole } from "@/lib/enums"
import { formatDate } from "@/lib/utils"

/**
 * 生信任务单生成（重构 §6.5）：按 docs/单细胞任务单-BP-G260506372.md 模板，
 * 从 Project + SampleBatch + Sample 叶子渲染结构化任务单（Markdown），供生信执行 / 作邮件附件。
 * 不新建实体——按需从数据渲染。数据驱动段填充、空白表单段（差异比较组/执行部/签核）作占位。
 */

export type TaskOrderOperator = { id: string; role?: UserRole }

export type TaskOrderLeaf = {
  sampleName: string | null
  species: string | null
  tissueType: string | null
  remark: string | null
}

export type TaskOrderData = {
  projectNo: string | null
  projectType: string
  serviceLevel: ServiceLevel
  sequencingPlatform: string | null
  customerOrg: string
  customerContact: string | null
  salesOwnerName: string | null
  projectManagerName: string | null
  batchNos: string[]
  species: string | null
  tissueType: string | null
  experimentType: string | null
  remark: string | null
  createdAt: Date
  leaves: TaskOrderLeaf[]
}

/** 载入任务单数据（在操作者可见范围内）；越权 / 不存在 → null */
export async function buildTaskOrderData(
  operator: TaskOrderOperator,
  projectId: string
): Promise<TaskOrderData | null> {
  const project = await prisma.project.findFirst({
    where: { AND: [{ id: projectId }, buildProjectScope(operator.role, operator.id)] },
    select: {
      projectNo: true,
      projectType: true,
      serviceLevel: true,
      sequencingPlatform: true,
      customerOrg: true,
      customerContact: true,
      createdAt: true,
      remark: true,
      salesOwner: { select: { name: true } },
      projectManager: { select: { name: true } },
      sampleBatches: {
        orderBy: { seq: "asc" },
        select: {
          batchNo: true,
          species: true,
          tissueType: true,
          experimentType: true,
          samples: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: { sampleName: true, species: true, tissueType: true, remark: true },
          },
        },
      },
    },
  })
  if (!project) return null

  const batches = project.sampleBatches
  const firstBatch = batches[0]
  return {
    projectNo: project.projectNo,
    projectType: project.projectType,
    serviceLevel: project.serviceLevel,
    sequencingPlatform: project.sequencingPlatform,
    customerOrg: project.customerOrg,
    customerContact: project.customerContact,
    salesOwnerName: project.salesOwner?.name ?? null,
    projectManagerName: project.projectManager?.name ?? null,
    batchNos: batches.map((b) => b.batchNo).filter((v): v is string => !!v),
    species: firstBatch?.species ?? null,
    tissueType: firstBatch?.tissueType ?? null,
    experimentType: firstBatch?.experimentType ?? null,
    remark: project.remark,
    createdAt: project.createdAt,
    leaves: batches.flatMap((b) => b.samples),
  }
}

/** 单元格转义：`|` → `\|`、换行折成空格，避免破坏 Markdown 表格 */
const esc = (v: string) => v.replace(/\r?\n/g, " ").replace(/\|/g, "\\|")
const dash = (v: string | null | undefined) => (v && v.trim() ? esc(v) : "—")

/** 项目名称：单位 | 物种 | 组织 | 检测项目（缺项跳过），对齐模板「项目名称」拼写法 */
function deriveProjectTitle(d: TaskOrderData): string {
  return [d.customerOrg, d.species, d.tissueType, d.projectType]
    .map((v) => v?.trim())
    .filter(Boolean)
    .join(" | ")
}

/** 渲染任务单 Markdown（纯函数，可单测；generatedAt 显式传入便于测试） */
export function renderTaskOrderMarkdown(d: TaskOrderData, generatedAt: Date = new Date()): string {
  const title = d.projectNo ?? "未编号草稿"
  const sampleCount = d.leaves.length
  const lines: string[] = []

  lines.push(`# 项目任务单 — ${title}`)
  lines.push("")
  lines.push(`> 由单细胞云平台于 ${formatDate(generatedAt)} 生成。数据来自项目记录，空白项请执行时补全。`)
  lines.push("")

  lines.push("## 项目基本信息")
  lines.push("")
  lines.push("| 字段 | 值 |")
  lines.push("|------|-----|")
  lines.push(`| 项目编号（委托单号） | ${dash(d.projectNo)} |`)
  lines.push(`| 项目名称 | ${dash(deriveProjectTitle(d))} |`)
  lines.push(`| 检测项目 | ${dash(d.projectType)} |`)
  lines.push(`| 服务档次 | ${SERVICE_LEVEL_LABELS[d.serviceLevel]} |`)
  lines.push(`| 测序平台 | ${dash(d.sequencingPlatform)} |`)
  lines.push(`| 销售 | ${dash(d.salesOwnerName)} |`)
  lines.push(`| 委托单位 | ${dash(d.customerOrg)} |`)
  lines.push(`| 委托方联系人 | ${dash(d.customerContact)} |`)
  lines.push(`| 样品编号 | ${d.batchNos.length ? d.batchNos.join("、") : "—"} |`)
  lines.push(`| 下单日期 | ${formatDate(d.createdAt)} |`)
  lines.push(`| 实验样品个数 | ${sampleCount} |`)
  lines.push("")

  lines.push("## 样品明细")
  lines.push("")
  lines.push("| 序号 | 报告组别名 | 收样名称 | 报告样品名称 | 样品类型 | 个数 | 用途 | 备注 |")
  lines.push("|------|-----------|---------|-------------|---------|------|------|------|")
  if (sampleCount === 0) {
    lines.push("| — | （尚未登记样本） | | | | | | |")
  } else {
    d.leaves.forEach((leaf, i) => {
      const name = dash(leaf.sampleName)
      const type = dash(leaf.tissueType ?? leaf.species)
      const remark = leaf.remark ? esc(leaf.remark) : ""
      lines.push(`| ${i + 1} | ${name} | | ${name} | ${type} | 1 | 提取 | ${remark} |`)
    })
  }
  lines.push("")

  lines.push("## 实验设计信息")
  lines.push("")
  lines.push(`- 物种：${dash(d.species)}`)
  lines.push(`- 组织：${dash(d.tissueType)}`)
  lines.push(`- 实验类型：${dash(d.experimentType)}`)
  lines.push("- 关注细胞类型：暂无（按标准分析流程执行，注释结果记录于生信任务）")
  lines.push(`- 项目备注：${dash(d.remark)}`)
  lines.push("")
  lines.push("### 差异比较分析")
  lines.push("")
  lines.push("（本平台未维护比较组信息，执行时与委托方确认后填写）")
  lines.push("")

  lines.push("## 项目执行部填写")
  lines.push("")
  lines.push("| 字段 | 值 |")
  lines.push("|------|-----|")
  lines.push("| 剩余原始样本存放位置 | |")
  lines.push("| 剩余处理后样本存放位置 | |")
  lines.push("")

  lines.push("## 签核")
  lines.push("")
  lines.push("| 项目负责人 | 报告人 | 审核人 |")
  lines.push("|-----------|--------|--------|")
  lines.push(`| ${d.projectManagerName ? esc(d.projectManagerName) : ""} | | |`)
  lines.push("")

  return lines.join("\n")
}

/** 下载文件名（ASCII 安全部分 + 项目号） */
export function taskOrderFilename(d: TaskOrderData): string {
  return `任务单-${d.projectNo ?? "草稿"}.md`
}
