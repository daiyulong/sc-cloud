import { vi } from "vitest"
import "@testing-library/jest-dom/vitest"

// jsdom 缺失的 API stub（Radix Select/Popper 在组件测试中需要）
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver
window.HTMLElement.prototype.scrollIntoView ??= () => {}
window.HTMLElement.prototype.hasPointerCapture ??= () => false
window.HTMLElement.prototype.releasePointerCapture ??= () => {}

// Mock next/navigation。工厂包成 vi.fn，测试文件可用
// vi.mocked(useRouter).mockReturnValue(...) 注入自己的 spy / URLSearchParams。
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => "/"),
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
