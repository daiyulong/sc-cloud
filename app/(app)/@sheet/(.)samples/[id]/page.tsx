import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import type { UserRole as UserRoleValue } from "@/lib/enums"
import { getSampleDetail } from "@/lib/samples/service"
import { DetailSheet, DetailSheetEmpty } from "@/components/detail/detail-sheet"
import { SampleSheetBody } from "@/components/samples/sample-sheet-body"

export const dynamic = "force-dynamic"

type InterceptedSamplePageProps = {
  params: Promise<{ id: string }>
}

/** /samples/[id] 的软导航拦截：在当前列表上以侧滑展示详情 */
export default async function InterceptedSamplePage({ params }: InterceptedSamplePageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params
  const detail = await getSampleDetail(
    { id: session.user.id, role: session.user.role as UserRoleValue },
    id
  ).catch(() => null)

  return (
    <DetailSheet title={detail ? `样本 ${detail.sample.sampleNo}` : "样本详情"}>
      {detail ? (
        <SampleSheetBody detail={detail} role={session.user.role} />
      ) : (
        <DetailSheetEmpty message="样本不存在或无权限查看。" />
      )}
    </DetailSheet>
  )
}
