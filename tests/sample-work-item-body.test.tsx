import type { ComponentProps } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ProjectStatus, SampleBatchStatus, UserRole } from "@/lib/enums"
import { SampleWorkItemBody } from "@/components/samples/sample-work-item-body"

type SampleWorkItemBodyProps = ComponentProps<typeof SampleWorkItemBody>

function makeDetail(projectStatus: ProjectStatus = ProjectStatus.waiting_sample) {
  return {
    sample: {
      id: "batch-1",
      batchNo: "YP-001",
      status: SampleBatchStatus.waiting_arrival,
      species: "小鼠",
      tissueType: "肝脏组织",
      sampleCount: 2,
      experimentType: "组织解离",
      transportCondition: "冷链",
      samplingDate: null,
      expectedArrivalDate: new Date("2026-07-03"),
      receivedAt: null,
      receiver: null,
      abnormalNote: null,
      remark: null,
      createdAt: new Date("2026-07-01"),
      samples: [],
      project: {
        id: "project-1",
        projectNo: "BP-G260601008",
        customerOrg: "上海市同济医院",
        customerName: "张三",
        status: projectStatus,
        serviceLevel: "standard",
        salesOwnerId: "sales-1",
      },
    },
    operationLogs: [],
  }
}

describe("SampleWorkItemBody", () => {
  it("项目草稿时前置拦截登记接收表单", () => {
    render(
      <SampleWorkItemBody
        detail={makeDetail(ProjectStatus.draft) as SampleWorkItemBodyProps["detail"]}
        role={UserRole.sample_receiver}
      />
    )

    expect(screen.getByText(/当前项目为草稿/)).toBeInTheDocument()
    expect(screen.getByText(/回项目工位确认项目/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "确认接收" })).not.toBeInTheDocument()
  })

  it("项目待到样时显示登记接收表单", () => {
    render(
      <SampleWorkItemBody
        detail={makeDetail(ProjectStatus.waiting_sample) as SampleWorkItemBodyProps["detail"]}
        role={UserRole.sample_receiver}
      />
    )

    expect(screen.getByRole("button", { name: "确认接收" })).toBeInTheDocument()
  })
})
