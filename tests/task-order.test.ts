import { describe, expect, it } from "vitest"
import {
  renderTaskOrderMarkdown,
  taskOrderFilename,
  type TaskOrderData,
} from "@/lib/bioinfo/task-order"
import { ServiceLevel } from "@/lib/enums"

const base: TaskOrderData = {
  projectNo: "BP-G260506372",
  projectType: "10X 3'GEM-X单细胞转录组 标准分析版",
  serviceLevel: ServiceLevel.standard,
  sequencingPlatform: "真迈",
  customerOrg: "四川大学华西口腔医院",
  customerContact: "林榆蒙",
  salesOwnerName: "路遥",
  projectManagerName: "肖敏",
  batchNos: ["YP20260505077"],
  species: "小鼠",
  tissueType: "组织",
  experimentType: "单细胞核转录组",
  remark: "组织（肿瘤及肺转移灶）",
  createdAt: new Date("2026-05-26T00:00:00Z"),
  leaves: [
    { sampleName: "Ctrl_T_1", species: "小鼠", tissueType: "小鼠肿瘤组织", remark: null },
    { sampleName: "cKO_T_1", species: "小鼠", tissueType: "小鼠肿瘤组织", remark: null },
  ],
}

const fixedAt = new Date("2026-06-29T00:00:00Z")

describe("renderTaskOrderMarkdown", () => {
  it("渲染标题与基本信息", () => {
    const md = renderTaskOrderMarkdown(base, fixedAt)
    expect(md).toContain("# 项目任务单 — BP-G260506372")
    expect(md).toContain("| 项目编号（委托单号） | BP-G260506372 |")
    expect(md).toContain("| 服务档次 | 标准分析 |")
    expect(md).toContain("| 样品编号 | YP20260505077 |")
    expect(md).toContain("| 实验样品个数 | 2 |")
  })

  it("项目名称按 单位|物种|组织|检测项目 拼接，内部竖线转义不破坏表格", () => {
    const md = renderTaskOrderMarkdown(base, fixedAt)
    expect(md).toContain(
      "| 项目名称 | 四川大学华西口腔医院 \\| 小鼠 \\| 组织 \\| 10X 3'GEM-X单细胞转录组 标准分析版 |"
    )
  })

  it("样品明细逐叶子成行、序号递增", () => {
    const md = renderTaskOrderMarkdown(base, fixedAt)
    expect(md).toContain("| 1 | Ctrl_T_1 | | Ctrl_T_1 | 小鼠肿瘤组织 | 1 | 提取 |")
    expect(md).toContain("| 2 | cKO_T_1 | | cKO_T_1 | 小鼠肿瘤组织 | 1 | 提取 |")
  })

  it("缺失字段以 — 占位、空样本给提示行", () => {
    const md = renderTaskOrderMarkdown(
      { ...base, projectNo: null, sequencingPlatform: null, customerContact: null, batchNos: [], leaves: [] },
      fixedAt
    )
    expect(md).toContain("# 项目任务单 — 未编号草稿")
    expect(md).toContain("| 测序平台 | — |")
    expect(md).toContain("| 委托方联系人 | — |")
    expect(md).toContain("| 样品编号 | — |")
    expect(md).toContain("（尚未登记样本）")
  })

  it("含空白表单段（执行部 / 签核）", () => {
    const md = renderTaskOrderMarkdown(base, fixedAt)
    expect(md).toContain("## 项目执行部填写")
    expect(md).toContain("## 签核")
    expect(md).toContain("| 肖敏 | | |")
  })

  it("文件名带项目号", () => {
    expect(taskOrderFilename(base)).toBe("任务单-BP-G260506372.md")
    expect(taskOrderFilename({ ...base, projectNo: null })).toBe("任务单-草稿.md")
  })
})
