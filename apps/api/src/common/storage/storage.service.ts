import { randomUUID } from 'crypto'

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'

const SIGNED_URL_TTL_SEC = 15 * 60 // 15 minutes

// Cloudflare R2 via the S3-compatible API. The client is created lazily so the
// app boots fine when credentials are absent (Documents just report "storage
// not configured" until R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY are filled in).
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)
  private client: S3Client | null = null

  // Read an env var, treating blanks and obvious placeholders ('...',
  // 'placeholder', 'your-...') as unset.
  private cfg(name: string): string | undefined {
    const v = (process.env[name] ?? '').trim()
    if (!v || v === '...' || v.toLowerCase() === 'placeholder' || v.toLowerCase().startsWith('your')) {
      return undefined
    }
    return v
  }

  private get bucket(): string {
    return this.cfg('R2_BUCKET_NAME') ?? ''
  }

  isConfigured(): boolean {
    return Boolean(
      this.cfg('R2_ENDPOINT') &&
        this.cfg('R2_BUCKET_NAME') &&
        this.cfg('R2_ACCESS_KEY_ID') &&
        this.cfg('R2_SECRET_ACCESS_KEY'),
    )
  }

  private getClient(): S3Client {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'File storage is not configured. Set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.',
      )
    }
    if (!this.client) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: this.cfg('R2_ENDPOINT'),
        forcePathStyle: true,
        credentials: {
          accessKeyId: this.cfg('R2_ACCESS_KEY_ID')!,
          secretAccessKey: this.cfg('R2_SECRET_ACCESS_KEY')!,
        },
      })
    }
    return this.client
  }

  // Build a namespaced object key. Keeps a uuid prefix so names never collide.
  buildKey(parts: { companyId: string; projectId?: string | null; fileName: string }): string {
    const safe = parts.fileName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120)
    const scope = parts.projectId ? `${parts.companyId}/${parts.projectId}` : parts.companyId
    return `documents/${scope}/${randomUUID()}-${safe}`
  }

  // Presigned PUT — the browser uploads the file straight to R2. The client must
  // send the same Content-Type it was signed with.
  async presignUpload(key: string, contentType: string): Promise<string> {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    })
    return getSignedUrl(this.getClient(), cmd, { expiresIn: SIGNED_URL_TTL_SEC })
  }

  // Presigned GET — time-limited download/preview link. `disposition` controls
  // inline preview vs. attachment download; `fileName` sets the download name.
  async presignDownload(
    key: string,
    fileName: string,
    disposition: 'inline' | 'attachment',
  ): Promise<string> {
    const cmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: `${disposition}; filename="${fileName.replace(/"/g, '')}"`,
    })
    return getSignedUrl(this.getClient(), cmd, { expiresIn: SIGNED_URL_TTL_SEC })
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.getClient().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
    } catch (err) {
      // Don't fail the request if the object was already gone — log only.
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.warn(`Failed to delete object ${key}: ${msg}`)
    }
  }
}
