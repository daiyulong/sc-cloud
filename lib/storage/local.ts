import { promises as fs } from "node:fs"
import path from "node:path"

/**
 * 本地磁盘私有存储（重构 §6，存证选型=本地磁盘）。
 * 实验记录原图存 STORAGE_DIR 下，私有——只经鉴权代理 Route 读，不直接对外暴露。
 * Docker 自托管时把 STORAGE_DIR 挂成持久卷。
 */
const STORAGE_ROOT = process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage")
const RECORD_SUBDIR = "experiment-records"

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}
const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
}

export function isSupportedImageType(mediaType: string): boolean {
  return mediaType in MIME_EXT
}
export function extForMime(mediaType: string): string {
  return MIME_EXT[mediaType] ?? "bin"
}
export function mimeForKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? ""
  return EXT_MIME[ext] ?? "application/octet-stream"
}

/** 解析并校验 key 落在存储目录内，防路径穿越 */
function resolveKey(key: string): string {
  const baseDir = path.join(STORAGE_ROOT, RECORD_SUBDIR)
  const full = path.normalize(path.join(baseDir, key))
  if (full !== baseDir && !full.startsWith(baseDir + path.sep)) {
    throw new Error("非法存储 key")
  }
  return full
}

export async function saveRecordImage(id: string, mediaType: string, bytes: Buffer): Promise<string> {
  const key = `${id}.${extForMime(mediaType)}`
  const full = resolveKey(key)
  await fs.mkdir(path.dirname(full), { recursive: true })
  await fs.writeFile(full, bytes)
  return key
}

export async function readRecordImage(key: string): Promise<Buffer> {
  return fs.readFile(resolveKey(key))
}

export async function deleteRecordImage(key: string): Promise<void> {
  await fs.rm(resolveKey(key), { force: true })
}
