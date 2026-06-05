import { DocumentAccessLevel, UserRole } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'

import { StorageService } from '../../common/storage/storage.service'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectsService } from '../projects/projects.service'

const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50MB

const uploaderSelect = { id: true, firstName: true, lastName: true } as const

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private projects: ProjectsService,
  ) {}

  private isAitek(user: AuthUser): boolean {
    return user.role === UserRole.AITEK_ADMIN || user.role === UserRole.AITEK_TEAM_MEMBER
  }

  private assertAitek(user: AuthUser): void {
    if (!this.isAitek(user)) {
      throw new ForbiddenException('Only the AiTek team can manage documents')
    }
  }

  storageConfigured(): boolean {
    return this.storage.isConfigured()
  }

  // Documents for a project. Clients see CLIENT_VISIBLE only; AiTek see all.
  async list(projectId: string, user: AuthUser) {
    await this.projects.requireProjectAccess(projectId, user)
    return this.prisma.document.findMany({
      where: {
        projectId,
        deletedAt: null,
        ...(this.isAitek(user) ? {} : { accessLevel: DocumentAccessLevel.CLIENT_VISIBLE }),
      },
      orderBy: { createdAt: 'desc' },
      include: { uploadedBy: { select: uploaderSelect } },
    })
  }

  // Step 1 — presigned PUT URL so the browser uploads straight to R2. AiTek only.
  async presignUpload(
    projectId: string,
    input: { fileName: string; fileSize: number; mimeType?: string },
    user: AuthUser,
  ) {
    const project = await this.projects.requireProjectAccess(projectId, user)
    this.assertAitek(user)

    if (!input.fileName?.trim()) throw new BadRequestException('fileName is required')
    if (!input.fileSize || input.fileSize <= 0) throw new BadRequestException('fileSize is required')
    if (input.fileSize > MAX_FILE_BYTES) {
      throw new BadRequestException('File exceeds the 50MB limit')
    }

    const contentType = input.mimeType || 'application/octet-stream'
    const key = this.storage.buildKey({
      companyId: project.companyId,
      projectId,
      fileName: input.fileName,
    })
    const uploadUrl = await this.storage.presignUpload(key, contentType)
    return { key, uploadUrl, contentType }
  }

  // Step 2 — register the Document row after the upload succeeded.
  async confirm(
    projectId: string,
    input: {
      key: string
      name?: string
      fileName: string
      fileSize: number
      mimeType?: string
      description?: string | null
      accessLevel?: DocumentAccessLevel
    },
    user: AuthUser,
  ) {
    const project = await this.projects.requireProjectAccess(projectId, user)
    this.assertAitek(user)

    if (!input.key?.startsWith('documents/')) throw new BadRequestException('Invalid storage key')
    if (!input.fileName?.trim()) throw new BadRequestException('fileName is required')

    const accessLevel =
      input.accessLevel === DocumentAccessLevel.CLIENT_VISIBLE
        ? DocumentAccessLevel.CLIENT_VISIBLE
        : DocumentAccessLevel.INTERNAL

    return this.prisma.document.create({
      data: {
        companyId: project.companyId,
        projectId,
        name: (input.name?.trim() || input.fileName).trim(),
        description: input.description?.trim() || null,
        fileKey: input.key,
        fileName: input.fileName,
        fileSize: input.fileSize,
        mimeType: input.mimeType || 'application/octet-stream',
        accessLevel,
        uploadedById: user.id,
      },
      include: { uploadedBy: { select: uploaderSelect } },
    })
  }

  // Time-limited signed URL for preview (inline) or download (attachment).
  async getDownloadUrl(
    projectId: string,
    documentId: string,
    disposition: 'inline' | 'attachment',
    user: AuthUser,
  ) {
    await this.projects.requireProjectAccess(projectId, user)
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, projectId, deletedAt: null },
    })
    // Hide internal docs from clients behind a 404 (don't leak existence).
    if (!doc || (!this.isAitek(user) && doc.accessLevel !== DocumentAccessLevel.CLIENT_VISIBLE)) {
      throw new NotFoundException('Document not found')
    }
    const url = await this.storage.presignDownload(doc.fileKey, doc.fileName, disposition)
    return { url }
  }

  async remove(projectId: string, documentId: string, user: AuthUser) {
    await this.projects.requireProjectAccess(projectId, user)
    this.assertAitek(user)
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, projectId, deletedAt: null },
    })
    if (!doc) throw new NotFoundException('Document not found')

    await this.prisma.document.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    })
    void this.storage.deleteObject(doc.fileKey) // best-effort
    return { deleted: true }
  }
}
