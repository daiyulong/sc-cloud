/**
 * 内存滑动窗口速率限制器。
 * 适用于单实例部署；多实例需改用 Redis。
 */

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

// 定期清理过期记录（每 5 分钟）
const CLEANUP_INTERVAL = 5 * 60 * 1000
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < CLEANUP_INTERVAL)
    if (entry.timestamps.length === 0) store.delete(key)
  }
}, CLEANUP_INTERVAL)

/**
 * 检查是否超出速率限制
 * @param key 限制键（如 IP、账号）
 * @param limit 窗口内最大请求数
 * @param windowMs 窗口时长（毫秒）
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number } {
  const now = Date.now()
  let entry = store.get(key)

  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)

  if (entry.timestamps.length >= limit) {
    return { success: false, remaining: 0 }
  }

  entry.timestamps.push(now)
  return { success: true, remaining: limit - entry.timestamps.length }
}
