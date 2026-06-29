import Link from "next/link"
import { redirect } from "next/navigation"
import { SearchX } from "lucide-react"
import { auth } from "@/lib/auth"
import { parsePagination } from "@/lib/api-utils"
import {
  USER_ROLE_LABELS,
  UserRole,
  type UserRole as UserRoleValue,
} from "@/lib/enums"
import { landingPathForRole } from "@/lib/auth/landing"
import { userListQuerySchema } from "@/lib/schemas/user"
import { listUsers } from "@/lib/users/service"
import { firstParam, formatDateTime } from "@/lib/utils"
import { ListEmpty } from "@/components/list/list-empty"
import { ListPager } from "@/components/list/list-pager"
import { ListToolbar } from "@/components/list/list-toolbar"
import { StatusDot } from "@/components/status-dot"
import { UserActionMenu } from "@/components/users/user-action-menu"
import { UserCreateButton } from "@/components/users/user-create-button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const dynamic = "force-dynamic"

type UsersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const USER_ACTIVE_DOT = {
  active: "bg-emerald-500",
  inactive: "bg-zinc-400",
} as const

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (session.user.role !== UserRole.admin) redirect(landingPathForRole(session.user.role))

  const raw = (await searchParams) ?? {}
  const query = userListQuerySchema.parse({
    q: firstParam(raw.q),
    role: firstParam(raw.role),
    isActive: firstParam(raw.isActive),
    page: firstParam(raw.page),
    limit: firstParam(raw.limit),
  })
  const { page, limit, skip } = parsePagination({
    page: firstParam(raw.page),
    limit: firstParam(raw.limit),
  })
  const { data: users, total } = await listUsers(query, { skip, limit })
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const baseParams = new URLSearchParams()
  for (const key of ["q", "role", "isActive"]) {
    const value = firstParam(raw[key])
    if (value) baseParams.set(key, value)
  }
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams(baseParams)
    params.set("page", String(nextPage))
    params.set("limit", String(limit))
    return `/system/users?${params.toString()}`
  }
  const hasActiveFilters = Boolean(query.q || query.role || query.isActive)

  return (
    <div className="group/list flex flex-1 flex-col gap-4 p-4 md:p-6">
      <h1 className="sr-only">用户管理</h1>
      <ListToolbar
        basePath="/system/users"
        searchPlaceholder="搜索姓名 / 用户名 / 邮箱…"
        searchDefault={query.q}
        filters={[
          {
            key: "role",
            label: "角色",
            allLabel: "全部角色",
            value: query.role,
            options: Object.values(UserRole).map((value) => ({
              value,
              label: USER_ROLE_LABELS[value],
            })),
          },
          {
            key: "isActive",
            label: "账号状态",
            allLabel: "全部状态",
            value: query.isActive,
            options: [
              { value: "true", label: "已启用", dot: USER_ACTIVE_DOT.active },
              { value: "false", label: "已停用", dot: USER_ACTIVE_DOT.inactive },
            ],
          },
        ]}
      >
        <UserCreateButton selfId={session.user.id} />
      </ListToolbar>

      {total === 0 ? (
        <ListEmpty
          icon={<SearchX />}
          title="无匹配结果"
          description="当前筛选条件下没有用户，调整或清除筛选后重试。"
        >
          {hasActiveFilters && (
            <Button variant="outline" asChild>
              <Link href="/system/users">清除筛选</Link>
            </Button>
          )}
        </ListEmpty>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border bg-card transition-opacity group-has-[[data-pending]]/list:opacity-60">
            <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>用户名</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>部门</TableHead>
                  <TableHead>邮箱</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>最后登录</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className={user.isActive ? undefined : "text-muted-foreground"}>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <Avatar size="sm">
                          <AvatarFallback>{user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        {user.name}
                        {user.id === session.user.id && (
                          <span className="font-normal text-muted-foreground">（我）</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>{USER_ROLE_LABELS[user.role as UserRoleValue]}</TableCell>
                    <TableCell>{user.department ?? "-"}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <StatusDot
                          className={user.isActive ? USER_ACTIVE_DOT.active : USER_ACTIVE_DOT.inactive}
                        />
                        {user.isActive ? "已启用" : "已停用"}
                      </span>
                    </TableCell>
                    <TableCell>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "从未登录"}</TableCell>
                    <TableCell className="text-right">
                      <UserActionMenu
                        user={{
                          id: user.id,
                          username: user.username,
                          email: user.email,
                          name: user.name,
                          role: user.role as UserRoleValue,
                          department: user.department,
                          phone: user.phone,
                          isActive: user.isActive,
                        }}
                        selfId={session.user.id}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ListPager total={total} page={page} totalPages={totalPages} noun="用户" hrefFor={pageHref} />
        </>
      )}
    </div>
  )
}
