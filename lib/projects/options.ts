import { prisma } from "@/lib/prisma"
import { UserRole } from "@/lib/enums"

export async function getProjectUserOptions() {
  const [salesUsers, managerUsers] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, role: UserRole.sales_owner },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { isActive: true, role: { in: [UserRole.admin, UserRole.project_manager] } },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
  ])

  return { salesUsers, managerUsers }
}
