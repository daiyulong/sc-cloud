import bcrypt from "bcryptjs"
import prisma from "../lib/prisma"
import { UserRole } from "../lib/enums"
import { seedDemoData } from "./seed-experience"

// 初始用户：管理员 + 7 角色各一个示例账号。username 唯一、幂等 upsert。
// 历史导入功能已删（一次性 demo 数据走 seed-experience，见下）。
const SEED_USERS: { username: string; name: string; role: UserRole; department?: string }[] = [
  { username: "admin", name: "系统管理员", role: UserRole.admin },
  { username: "sales", name: "示例销售", role: UserRole.sales_owner },
  { username: "pm", name: "示例项目经理", role: UserRole.project_manager },
  { username: "receiver", name: "示例收样员", role: UserRole.sample_receiver },
  { username: "lab", name: "示例实验员", role: UserRole.lab_operator, department: "时空部" },
  { username: "bioinfo", name: "示例生信", role: UserRole.bioinfo_analyst },
  { username: "viewer", name: "示例只读", role: UserRole.viewer },
]

const DEFAULT_PASSWORD = "password123"

async function main() {
  const password = await bcrypt.hash(DEFAULT_PASSWORD, 10)

  for (const u of SEED_USERS) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: { name: u.name, role: u.role, department: u.department ?? null },
      create: {
        username: u.username,
        email: `${u.username}@sc-cloud.local`,
        name: u.name,
        role: u.role,
        department: u.department ?? null,
        password,
      },
    })
    console.log(`seeded user: ${u.username} (${u.role})`)
  }

  console.log(`\n初始账号已就绪，统一初始密码：${DEFAULT_PASSWORD}`)

  await seedDemoData()
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
