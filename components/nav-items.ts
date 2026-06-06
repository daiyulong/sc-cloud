import {
  BookOpen,
  Dna,
  FlaskConical,
  FolderKanban,
  LayoutDashboard,
  Microscope,
  PackageCheck,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
}

export const primaryNavItems: NavItem[] = [
  { title: "工作台", href: "/dashboard", icon: LayoutDashboard },
  { title: "项目", href: "/projects", icon: FolderKanban },
  { title: "样本接收", href: "/samples", icon: Microscope },
  { title: "实验排期", href: "/experiment-tasks", icon: FlaskConical },
  { title: "生信分析", href: "/bioinfo-tasks", icon: Dna },
  { title: "交付", href: "/delivery", icon: PackageCheck },
  { title: "经验库", href: "/experiences", icon: BookOpen },
]

export const adminNavItems: NavItem[] = [
  { title: "历史导入", href: "/imports", icon: Upload },
  { title: "用户管理", href: "/system/users", icon: Users },
]

/** 按路径前缀匹配当前页所属导航项（用于顶栏标题） */
export function matchNavItem(pathname: string): NavItem | undefined {
  return [...primaryNavItems, ...adminNavItems].find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  )
}
