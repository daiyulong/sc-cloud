import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  FlaskConical,
  Microscope,
} from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildProjectScope } from "@/lib/auth/role-scope"
import {
  PROJECT_STATUS_LABELS,
  ProjectStatus,
  SampleStatus,
  type UserRole,
} from "@/lib/enums"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const dynamic = "force-dynamic"

type DashboardData = {
  role?: UserRole
  metrics: {
    activeProjects: number
    pendingConfirmation: number
    waitingSample: number
    sampleReceived: number
    labInProgress: number
    waitingBioinfo: number
    bioinfoInProgress: number
    waitingDelivery: number
    abnormalProjects: number
    completedProjects: number
    todayExperimentTasks: number
    waitingFeedbackTasks: number
    openBioinfoTasks: number
    receivedSamples: number
    dueSoonProjects: number
    todayExpectedSamples: number
  }
}

type WorkQueueItem = {
  title: string
  count: number
  caption: string
  href: string
  tone?: "default" | "warning" | "danger"
}

function dateRangeToday() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  const dueSoonEnd = new Date(start)
  dueSoonEnd.setDate(dueSoonEnd.getDate() + 7)

  return { start, end, dueSoonEnd }
}

async function getDashboardData(): Promise<DashboardData | null> {
  const session = await auth()
  if (!session?.user?.id) return null

  const role = session.user.role as UserRole | undefined
  const projectScope = buildProjectScope(role, session.user.id)
  const { start, end, dueSoonEnd } = dateRangeToday()

  try {
    const [
      activeProjects,
      pendingConfirmation,
      waitingSample,
      sampleReceived,
      labInProgress,
      waitingBioinfo,
      bioinfoInProgress,
      waitingDelivery,
      abnormalProjects,
      completedProjects,
      todayExperimentTasks,
      waitingFeedbackTasks,
      openBioinfoTasks,
      receivedSamples,
      dueSoonProjects,
      todayExpectedSamples,
    ] = await Promise.all([
      prisma.project.count({
        where: {
          AND: [
            projectScope,
            { status: { notIn: [ProjectStatus.completed, ProjectStatus.terminated] } },
          ],
        },
      }),
      prisma.project.count({
        where: { AND: [projectScope, { status: ProjectStatus.draft }] },
      }),
      prisma.project.count({
        where: { AND: [projectScope, { status: ProjectStatus.waiting_sample }] },
      }),
      prisma.project.count({
        where: { AND: [projectScope, { status: ProjectStatus.sample_received }] },
      }),
      prisma.project.count({
        where: { AND: [projectScope, { status: ProjectStatus.lab_in_progress }] },
      }),
      prisma.project.count({
        where: { AND: [projectScope, { status: ProjectStatus.waiting_bioinfo }] },
      }),
      prisma.project.count({
        where: { AND: [projectScope, { status: ProjectStatus.bioinfo_in_progress }] },
      }),
      prisma.project.count({
        where: { AND: [projectScope, { status: ProjectStatus.waiting_delivery }] },
      }),
      prisma.project.count({
        where: { AND: [projectScope, { status: ProjectStatus.abnormal }] },
      }),
      prisma.project.count({
        where: { AND: [projectScope, { status: ProjectStatus.completed }] },
      }),
      prisma.experimentTask.count({
        where: {
          project: projectScope,
          plannedDate: { gte: start, lt: end },
          status: { in: ["scheduled", "in_progress", "waiting_feedback"] },
        },
      }),
      prisma.experimentTask.count({
        where: {
          project: projectScope,
          status: "waiting_feedback",
        },
      }),
      prisma.bioinfoTask.count({
        where: {
          project: projectScope,
          status: { in: ["pending", "in_progress", "waiting_review"] },
        },
      }),
      prisma.sample.count({
        where: { project: projectScope, receivedAt: { not: null } },
      }),
      prisma.project.count({
        where: {
          AND: [
            projectScope,
            {
              expectedDeliveryDate: { gte: start, lt: dueSoonEnd },
              status: {
                notIn: [ProjectStatus.completed, ProjectStatus.terminated],
              },
            },
          ],
        },
      }),
      prisma.sample.count({
        where: {
          project: projectScope,
          status: SampleStatus.waiting_arrival,
          expectedArrivalDate: { gte: start, lt: end },
        },
      }),
    ])

    return {
      role,
      metrics: {
        activeProjects,
        pendingConfirmation,
        waitingSample,
        sampleReceived,
        labInProgress,
        waitingBioinfo,
        bioinfoInProgress,
        waitingDelivery,
        abnormalProjects,
        completedProjects,
        todayExperimentTasks,
        waitingFeedbackTasks,
        openBioinfoTasks,
        receivedSamples,
        dueSoonProjects,
        todayExpectedSamples,
      },
    }
  } catch (error) {
    console.error("读取工作台指标失败:", error)
    return null
  }
}

function buildWorkQueue(role: UserRole | undefined, metrics: DashboardData["metrics"]) {
  const fallback: WorkQueueItem[] = [
    {
      title: "待确认项目",
      count: metrics.pendingConfirmation,
      caption: "草稿项目",
      href: "/projects?status=draft",
    },
    {
      title: "待到样",
      count: metrics.waitingSample,
      caption: "收样前置",
      href: "/projects?status=waiting_sample",
    },
    {
      title: "待交付项目",
      count: metrics.waitingDelivery,
      caption: "交付确认",
      href: "/delivery",
    },
    {
      title: "异常项目",
      count: metrics.abnormalProjects,
      caption: "需处理",
      href: "/projects?status=abnormal",
      tone: "danger",
    },
  ]

  switch (role) {
    case "sales_owner":
      return [
        {
          title: "待补全项目",
          count: metrics.pendingConfirmation,
          caption: "销售草稿",
          href: "/projects?status=draft",
        },
        {
          title: "7 天内交付",
          count: metrics.dueSoonProjects,
          caption: "客户预期",
          href: "/projects?due=soon",
          tone: "warning",
        },
        {
          title: "异常项目",
          count: metrics.abnormalProjects,
          caption: "客户沟通",
          href: "/projects?status=abnormal",
          tone: "danger",
        },
      ] satisfies WorkQueueItem[]
    case "sample_receiver":
      return [
        {
          title: "待到样",
          count: metrics.waitingSample,
          caption: "待接收",
          href: "/samples?status=waiting_arrival",
        },
        {
          title: "已接收样本",
          count: metrics.receivedSamples,
          caption: "权限范围内",
          href: "/samples?received=1",
        },
        {
          title: "异常项目",
          count: metrics.abnormalProjects,
          caption: "收样异常",
          href: "/projects?status=abnormal",
          tone: "danger",
        },
      ] satisfies WorkQueueItem[]
    case "lab_operator":
      return [
        {
          title: "今日实验",
          count: metrics.todayExperimentTasks,
          caption: "已排期",
          href: "/experiment-tasks?date=today",
        },
        {
          title: "待反馈",
          count: metrics.waitingFeedbackTasks,
          caption: "实验结果",
          href: "/experiment-tasks?status=waiting_feedback",
          tone: "warning",
        },
        {
          title: "实验中项目",
          count: metrics.labInProgress,
          caption: "进行中",
          href: "/projects?status=lab_in_progress",
        },
      ] satisfies WorkQueueItem[]
    case "bioinfo_analyst":
      return [
        {
          title: "待分析",
          count: metrics.waitingBioinfo,
          caption: "项目入口",
          href: "/projects?status=waiting_bioinfo",
        },
        {
          title: "生信任务",
          count: metrics.openBioinfoTasks,
          caption: "进行中",
          href: "/bioinfo-tasks?open=1",
          tone: "warning",
        },
        {
          title: "待交付",
          count: metrics.waitingDelivery,
          caption: "报告交付",
          href: "/bioinfo-tasks?status=waiting_delivery",
        },
      ] satisfies WorkQueueItem[]
    case "viewer":
      return [
        {
          title: "可见项目",
          count: metrics.activeProjects,
          caption: "未关闭",
          href: "/projects",
        },
        {
          title: "待交付",
          count: metrics.waitingDelivery,
          caption: "交付节点",
          href: "/delivery",
        },
        {
          title: "已完成",
          count: metrics.completedProjects,
          caption: "历史闭环",
          href: "/projects?status=completed",
        },
      ] satisfies WorkQueueItem[]
    default:
      return fallback
  }
}

const pipelineStages = [
  ProjectStatus.draft,
  ProjectStatus.waiting_sample,
  ProjectStatus.sample_received,
  ProjectStatus.lab_in_progress,
  ProjectStatus.waiting_bioinfo,
  ProjectStatus.bioinfo_in_progress,
  ProjectStatus.waiting_delivery,
  ProjectStatus.completed,
] as const

function QueueRow({ item }: { item: WorkQueueItem }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-sm font-semibold text-accent-foreground tabular-nums",
            // 计数为 0 时保持中性色，仅有实际数量才用警示色
            item.count > 0 && item.tone === "danger" && "bg-destructive text-destructive-foreground",
            item.count > 0 && item.tone === "warning" && "bg-secondary text-secondary-foreground"
          )}
        >
          {item.count}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.title}</p>
          <p className="truncate text-xs text-muted-foreground">{item.caption}</p>
        </div>
      </div>
      <Button variant="ghost" size="sm" asChild>
        <Link href={item.href} aria-label={`进入${item.title}`}>
          进入
          <ArrowRight data-icon="inline-end" aria-hidden="true" />
        </Link>
      </Button>
    </div>
  )
}

export default async function DashboardPage() {
  const data = await getDashboardData()
  const metrics =
    data?.metrics ??
    ({
      activeProjects: 0,
      pendingConfirmation: 0,
      waitingSample: 0,
      sampleReceived: 0,
      labInProgress: 0,
      waitingBioinfo: 0,
      bioinfoInProgress: 0,
      waitingDelivery: 0,
      abnormalProjects: 0,
      completedProjects: 0,
      todayExperimentTasks: 0,
      waitingFeedbackTasks: 0,
      openBioinfoTasks: 0,
      receivedSamples: 0,
      dueSoonProjects: 0,
      todayExpectedSamples: 0,
    } satisfies DashboardData["metrics"])
  const workQueue = buildWorkQueue(data?.role, metrics)

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <h1 className="sr-only">工作台</h1>
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>待办队列</CardTitle>
            <CardDescription>按当前角色收敛</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {workQueue.map((item) => (
              <QueueRow key={item.title} item={item} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>需要关注</CardTitle>
            <CardDescription>异常、临期与今日到样</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <Link
              href="/projects?status=abnormal"
              className="group flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium group-hover:underline">
                <AlertTriangle aria-hidden="true" />
                异常项目
              </span>
              <Badge variant={metrics.abnormalProjects > 0 ? "destructive" : "secondary"}>
                {metrics.abnormalProjects}
              </Badge>
            </Link>
            <Link
              href="/projects?due=soon"
              className="group flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium group-hover:underline">
                <Clock aria-hidden="true" />
                7 天内交付
              </span>
              <Badge variant={metrics.dueSoonProjects > 0 ? "default" : "secondary"}>
                {metrics.dueSoonProjects}
              </Badge>
            </Link>
            <Link
              href="/samples?status=waiting_arrival"
              className="group flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium group-hover:underline">
                <Microscope aria-hidden="true" />
                今日预计到样
              </span>
              <Badge variant={metrics.todayExpectedSamples > 0 ? "default" : "secondary"}>
                {metrics.todayExpectedSamples}
              </Badge>
            </Link>
            <Link
              href="/experiment-tasks?status=waiting_feedback"
              className="group flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium group-hover:underline">
                <FlaskConical aria-hidden="true" />
                待实验反馈
              </span>
              <Badge variant={metrics.waitingFeedbackTasks > 0 ? "default" : "secondary"}>
                {metrics.waitingFeedbackTasks}
              </Badge>
            </Link>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>项目流转</CardTitle>
          <CardDescription>主状态轨道</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <div className="grid min-w-[780px] grid-cols-8 gap-2">
              {pipelineStages.map((status) => {
                const countByStatus: Record<(typeof pipelineStages)[number], number> = {
                  [ProjectStatus.draft]: metrics.pendingConfirmation,
                  [ProjectStatus.waiting_sample]: metrics.waitingSample,
                  [ProjectStatus.sample_received]: metrics.sampleReceived,
                  [ProjectStatus.lab_in_progress]: metrics.labInProgress,
                  [ProjectStatus.waiting_bioinfo]: metrics.waitingBioinfo,
                  [ProjectStatus.bioinfo_in_progress]: metrics.bioinfoInProgress,
                  [ProjectStatus.waiting_delivery]: metrics.waitingDelivery,
                  [ProjectStatus.completed]: metrics.completedProjects,
                }

                return (
                  <Link
                    key={status}
                    href={`/projects?status=${status}`}
                    className="group flex min-h-24 flex-col justify-between rounded-md bg-muted/50 p-3 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="text-xs text-muted-foreground">
                      {PROJECT_STATUS_LABELS[status]}
                    </span>
                    <span className="text-2xl font-semibold tabular-nums">
                      {countByStatus[status]}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {data === null && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          无法读取数据库指标。
        </p>
      )}
    </div>
  )
}
