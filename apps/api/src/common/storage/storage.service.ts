import { randomUUID } from 'crypto'
import { createReadStream, promises as fs, type ReadStream } from 'fs'
import { dirname, join, resolve, sep } from 'path'

import { Injectable, Logger, NotFoundException } from '@nestjs/common'

// Local filesystem storage on the host VPS. Files live under STORAGE_DIR (a
// Docker bind-mount in production so they survive container rebuilds). Replaces
// the former Cloudflare R2 / S3 backend — at portal scale, streaming through the
// API is simpler than presigned object storage and keeps data on our own box.
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)

  // Absolute storage root. Defaults to a repo-local `.storage` dir for local
  // dev; production sets STORAGE_DIR=/app/storage (a bind-mounted host folder).
  private readonly root = resolve(
    process.env['STORAGE_DIR']?.trim() || join(process.cwd(), '.storage'),
  )

  // Local disk is always available. Kept for parity with the old R2 service —
  // the documents UI calls this to decide whether to show the upload control.
  isConfigured(): boolean {
    return true
  }

  // Build a namespaced storage key. A uuid prefix keeps names collision-free;
  // the original (sanitised) filename is retained for readability. `prefix`
  // separates kinds of files on disk (default "documents", e.g. "kyc").
  buildKey(parts: {
    companyId: string
    projectId?: string | null
    fileName: string
    prefix?: string
  }): string {
    const safe = parts.fileName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120)
    const scope = parts.projectId ? `${parts.companyId}/${parts.projectId}` : parts.companyId
    return `${parts.prefix ?? 'documents'}/${scope}/${randomUUID()}-${safe}`
  }

  // Resolve a storage key to an absolute path, guarding against traversal — a
  // crafted key (e.g. "../../etc/passwd") must never escape the storage root.
  private resolvePath(key: string): string {
    const abs = resolve(this.root, key)
    if (abs !== this.root && !abs.startsWith(this.root + sep)) {
      throw new NotFoundException('Invalid storage key')
    }
    return abs
  }

  // Persist a file's bytes, creating parent directories as needed.
  async save(key: string, data: Buffer): Promise<void> {
    const abs = this.resolvePath(key)
    await fs.mkdir(dirname(abs), { recursive: true })
    await fs.writeFile(abs, data)
  }

  // Size on disk; throws 404 if the file is missing (e.g. row exists but the
  // bytes were lost).
  async stat(key: string): Promise<{ size: number }> {
    try {
      const s = await fs.stat(this.resolvePath(key))
      return { size: s.size }
    } catch {
      throw new NotFoundException('File not found')
    }
  }

  // Open a read stream for download/preview. Call stat() first to surface a
  // clean 404 — a stream on a missing path errors asynchronously.
  createReadStream(key: string): ReadStream {
    return createReadStream(this.resolvePath(key))
  }

  // Read the whole file into memory (e.g. to hash it). Caller is responsible for
  // only doing this on size-bounded files.
  async readToBuffer(key: string): Promise<Buffer> {
    return fs.readFile(this.resolvePath(key))
  }

  // Best-effort delete — never fail the request if the file is already gone.
  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolvePath(key))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.warn(`Failed to delete file ${key}: ${msg}`)
    }
  }
}
