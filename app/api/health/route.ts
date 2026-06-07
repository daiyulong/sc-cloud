import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  let dbOk = false
  try {
    await prisma.$queryRaw`SELECT 1`
    dbOk = true
  } catch {
    // DB 不可达时不抛异常，返回降级状态
  }

  return NextResponse.json(
    {
      ok: dbOk,
      service: "sc-cloud",
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0",
      commit: process.env.NEXT_PUBLIC_BUILD_COMMIT ?? "unknown",
      db: dbOk ? "connected" : "unreachable",
    },
    { status: dbOk ? 200 : 503 }
  )
}
