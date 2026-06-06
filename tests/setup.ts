import { vi } from "vitest"
import "@testing-library/jest-dom/vitest"

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
  usePathname: () => "/",
}))

// Mock next-auth（阻断 next/server 模块解析链，单测不连真实会话）
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({
    user: {
      id: "test-user-id",
      name: "测试管理员",
      email: "admin@sc-cloud.local",
      role: "admin",
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  })),
}))
