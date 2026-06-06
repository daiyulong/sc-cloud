import { NextResponse } from "next/server"

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "sc-cloud",
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0",
    commit: process.env.NEXT_PUBLIC_BUILD_COMMIT ?? "unknown",
  })
}
