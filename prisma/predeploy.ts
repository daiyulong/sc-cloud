import prisma from "../lib/prisma"

/**
 * 部署前容错迁移：把本轮 schema 已删除的旧枚举值重映射到新值，
 * 避免随后的 `prisma db push --accept-data-loss` 在改 ProjectStatus 枚举时，
 * 因线上仍有行使用旧值（confirmed/delivered）而失败（Postgres 改枚举要求无行引用旧值）。
 *
 * 幂等：迁移完成后枚举里已无这些旧值，再跑这些 UPDATE 会报 "invalid enum value"，
 * 被逐句 try/catch 跳过；表尚不存在（首次部署）同理跳过。纯 raw SQL，不依赖客户端枚举类型。
 */
const statements = [
  "UPDATE projects SET status = 'waiting_sample' WHERE status = 'confirmed'",
  "UPDATE projects SET status = 'completed' WHERE status = 'delivered'",
  "UPDATE projects SET status_before_abnormal = 'waiting_sample' WHERE status_before_abnormal = 'confirmed'",
  "UPDATE projects SET status_before_abnormal = 'completed' WHERE status_before_abnormal = 'delivered'",
]

async function main() {
  for (const sql of statements) {
    try {
      const affected = await prisma.$executeRawUnsafe(sql)
      if (affected) console.log(`[predeploy] ${sql} -> ${affected} 行`)
    } catch (error) {
      console.warn(`[predeploy] 跳过（旧值/表已不存在）：${sql} :: ${(error as Error).message}`)
    }
  }
  await prisma.$disconnect()
}

main().catch(async (error) => {
  // 预迁移不应阻断部署：db push 会给出真正的 schema 同步结果
  console.warn("[predeploy] 整体跳过:", (error as Error).message)
  await prisma.$disconnect().catch(() => {})
})
