import {
  BookOpen,
  Dna,
  FlaskConical,
  FolderKanban,
  Inbox,
  Users,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  /** 队列角标键：服务端按角色算计数后按此键下传（见 app-sidebar / layout） */
  key?: string
}

// 工位制导航（5+1）：项目 / 收样 / 实验 / 生信 / 经验库（管理员另加用户）。
// 全员可见不设墙；角色落地页由 landingPathForRole 决定。
export const primaryNavItems: NavItem[] = [
  { title: "项目", href: "/projects", icon: FolderKanban, key: "projects" },
  { title: "收样", href: "/intake", icon: Inbox, key: "intake" },
  { title: "实验", href: "/lab", icon: FlaskConical, key: "lab" },
  { title: "生信", href: "/bioinfo-tasks", icon: Dna, key: "bioinfo" },
  { title: "经验库", href: "/experiences", icon: BookOpen },
]

export const adminNavItems: NavItem[] = [
  { title: "用户", href: "/system/users", icon: Users },
]

// 列表已移到 /intake、/lab，但叶子/任务详情仍在原路径；为顶栏标题补映射。
const detailTitleRoutes: { prefix: string; title: string }[] = [
  { prefix: "/samples", title: "样本" },
  { prefix: "/experiment-tasks", title: "实验任务" },
]

/** 顶栏标题：先按导航项前缀匹配，再回退到详情路由映射 */
export function resolvePageTitle(pathname: string): string | null {
  const navItem = [...primaryNavItems, ...adminNavItems].find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  )
  if (navItem) return navItem.title
  const detail = detailTitleRoutes.find((r) => pathname.startsWith(`${r.prefix}/`))
  return detail?.title ?? null
}
