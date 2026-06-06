import type { NextConfig } from "next"
import { execSync } from "child_process"
import { readFileSync } from "fs"
import { resolve } from "path"

// 读取 package.json 版本号
function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf-8"))
    return typeof pkg.version === "string" ? pkg.version : "0.0.0"
  } catch {
    return "0.0.0"
  }
}

// 读取当前 git commit 短 hash；CI 或本地可能没有 git，安全降级
function readCommit(): string {
  if (process.env.GIT_COMMIT_SHA) {
    return process.env.GIT_COMMIT_SHA.slice(0, 7)
  }
  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim()
  } catch {
    return "unknown"
  }
}

const APP_VERSION = readVersion()
const BUILD_COMMIT = readCommit()
const BUILD_TIME = new Date().toISOString()

const nextConfig: NextConfig = {
  // Docker 多阶段构建：输出独立产物
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
    NEXT_PUBLIC_BUILD_COMMIT: BUILD_COMMIT,
    NEXT_PUBLIC_BUILD_TIME: BUILD_TIME,
  },
}

export default nextConfig
