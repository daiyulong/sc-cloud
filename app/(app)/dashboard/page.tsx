import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  FlaskConical,
  PackageCheck,
} from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildProjectScope } from "@/lib/auth/role-scope"
import {
  PROJECT_STATUS_LABELS,
  ProjectStatus,
  SERVICE_LEVEL_LABELS,
  ServiceLevel,
  USER_ROLE_LABELS,
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
    confirmedProjects: number
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
      confirmedProjects,
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
        where: { AND: [projectScope, { status: ProjectStatus.confirmed }] },
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
    ])

    return {
      role,
      metrics: {
        activeProjects,
        pendingConfirmation,
        confirmedProjects,
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
          href: "/delivery?status=waiting_delivery",
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
          href: "/delivery?status=waiting_delivery",
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
  ProjectStatus.confirmed,
  ProjectStatus.waiting_sample,
  ProjectStatus.sample_received,
  ProjectStatus.lab_in_progress,
  ProjectStatus.waiting_bioinfo,
  ProjectStatus.bioinfo_in_progress,
  ProjectStatus.waiting_delivery,
  ProjectStatus.completed,
] as const

const serviceRoutes = [
  ServiceLevel.qc,
  ServiceLevel.library,
  ServiceLevel.run,
  ServiceLevel.standard,
  ServiceLevel.advanced,
] as const

function QueueRow({ item }: { item: WorkQueueItem }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-md border px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-sm font-semibold text-accent-foreground tabular-nums",
            item.tone === "danger" && "bg-destructive text-destructive-foreground",
            item.tone === "warning" && "bg-secondary text-secondary-foreground"
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
        <Link href={item.href}>
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
      confirmedProjects: 0,
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
    } satisfies DashboardData["metrics"])
  const workQueue = buildWorkQueue(data?.role, metrics)
  const roleLabel = data?.role ? USER_ROLE_LABELS[data.role] : "当前用户"

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-pretty text-2xl font-semibold tracking-normal">工作台</h1>
          <Badge variant="secondary">{roleLabel}</Badge>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span>活跃项目 {metrics.activeProjects}</span>
          <span>·</span>
          <span>今日实验 {metrics.todayExperimentTasks}</span>
          <span>·</span>
          <span>待交付 {metrics.waitingDelivery}</span>
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>待办队列</CardTitle>
            <CardDescription>按当前角色收敛</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {workQueue.map((item) => (
              <QueueRow key={item.title} item={item} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>今日节奏</CardTitle>
            <CardDescription>实验、反馈、交付</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <CalendarClock aria-hidden="true" />
                今日实验任务
              </span>
              <Badge variant="secondary">{metrics.todayExperimentTasks}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <FlaskConical aria-hidden="true" />
                待实验反馈
              </span>
              <Badge variant={metrics.waitingFeedbackTasks > 0 ? "default" : "secondary"}>
                {metrics.waitingFeedbackTasks}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <Clock aria-hidden="true" />
                7 天内交付
              </span>
              <Badge variant={metrics.dueSoonProjects > 0 ? "default" : "secondary"}>
                {metrics.dueSoonProjects}
              </Badge>
            </div>
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
            <div className="grid min-w-[880px] grid-cols-9 gap-2">
              {pipelineStages.map((status) => {
                const countByStatus: Record<(typeof pipelineStages)[number], number> = {
                  [ProjectStatus.draft]: metrics.pendingConfirmation,
                  [ProjectStatus.confirmed]: metrics.confirmedProjects,
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
                    className="group flex min-h-24 flex-col justify-between rounded-md border bg-background p-3 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
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

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>重点关注</CardTitle>
            <CardDescription>异常与临近交付</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <AlertTriangle aria-hidden="true" />
                异常项目
              </span>
              <Badge variant={metrics.abnormalProjects > 0 ? "destructive" : "secondary"}>
                {metrics.abnormalProjects}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <PackageCheck aria-hidden="true" />
                待交付项目
              </span>
              <Badge variant={metrics.waitingDelivery > 0 ? "default" : "secondary"}>
                {metrics.waitingDelivery}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <CheckCircle2 aria-hidden="true" />
                已完成项目
              </span>
              <Badge variant="secondary">{metrics.completedProjects}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>服务路径</CardTitle>
            <CardDescription>实验后交付 / 经生信交付</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {serviceRoutes.map((level) => (
              <div key={level} className="rounded-md border px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <ClipboardList aria-hidden="true" />
                  <span className="truncate text-sm font-medium">
                    {SERVICE_LEVEL_LABELS[level]}
                  </span>
                </div>
                <Badge
                  className="mt-3"
                  variant={
                    level === ServiceLevel.standard || level === ServiceLevel.advanced
                      ? "default"
                      : "secondary"
                  }
                >
                  {level === ServiceLevel.standard || level === ServiceLevel.advanced
                    ? "经生信"
                    : "实验后交付"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {data === null && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          无法读取数据库指标。
        </p>
      )}
    </div>
  )
}
