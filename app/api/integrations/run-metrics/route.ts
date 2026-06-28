import { NextResponse } from "next/server"
import { handleApiError, parseJsonBody } from "@/lib/api-utils"
import { requireServiceToken } from "@/lib/integrations/auth"
import { reportRunMetricsSchema } from "@/lib/schemas/integration"
import { handleIntegrationError, reportRunMetrics } from "@/lib/integrations/service"

/**
 * 产出指标机对机上报（重构 §6.5）：生信系统侧 cellranger 产出经此回写。
 * 服务令牌鉴权（INTEGRATION_API_KEY），按 projectNo+sampleName 定位叶子写产出，幂等、可订正。
 */
export async function POST(request: Request) {
  try {
    const authError = requireServiceToken(request)
    if (authError) return authError

    const input = reportRunMetricsSchema.parse(await parseJsonBody(request))
    const result = await reportRunMetrics(input)

    return NextResponse.json({ data: result })
  } catch (error) {
    return handleIntegrationError(error) ?? handleApiError(error, "产出指标上报失败")
  }
}
