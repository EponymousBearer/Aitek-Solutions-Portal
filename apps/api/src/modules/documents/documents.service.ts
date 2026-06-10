import type { ReadStream } from 'fs'

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

  // Single-step upload: the file streams through the API to local disk, then we
  // register the Document row. AiTek only.
  async upload(
    projectId: string,
    file: Express.Multer.File | undefined,
    input: { name?: string; description?: string | null; accessLevel?: DocumentAccessLevel },
    user: AuthUser,
  ) {
    const project = await this.projects.requireProjectAccess(projectId, user)
    this.assertAitek(user)

    if (!file) throw new BadRequestException('No file provided')
    if (!file.size || file.size <= 0) throw new BadRequestException('File is empty')
    if (file.size > MAX_FILE_BYTES) throw new BadRequestException('File exceeds the 50MB limit')

    const key = this.storage.buildKey({
      companyId: project.companyId,
      projectId,
      fileName: file.originalname,
    })
    await this.storage.save(key, file.buffer)

    const accessLevel =
      input.accessLevel === DocumentAccessLevel.CLIENT_VISIBLE
        ? DocumentAccessLevel.CLIENT_VISIBLE
        : DocumentAccessLevel.INTERNAL

    return this.prisma.document.create({
      data: {
        companyId: project.companyId,
        projectId,
        name: (input.name?.trim() || file.originalname).trim(),
        description: input.description?.trim() || null,
        fileKey: key,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype || 'application/octet-stream',
        accessLevel,
        uploadedById: user.id,
      },
      include: { uploadedBy: { select: uploaderSelect } },
    })
  }

  // Resolve a document for download/preview after access checks, returning an
  // open read stream plus the metadata the controller needs for its headers.
  async openDownload(
    projectId: string,
    documentId: string,
    user: AuthUser,
  ): Promise<{
    stream: ReadStream
    fileName: string
    mimeType: string
    size: number
  }> {
    await this.projects.requireProjectAccess(projectId, user)
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, projectId, deletedAt: null },
    })
    // Hide internal docs from clients behind a 404 (don't leak existence).
    if (!doc || (!this.isAitek(user) && doc.accessLevel !== DocumentAccessLevel.CLIENT_VISIBLE)) {
      throw new NotFoundException('Document not found')
    }
    const { size } = await this.storage.stat(doc.fileKey)
    return {
      stream: this.storage.createReadStream(doc.fileKey),
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      size,
    }
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
    void this.storage.delete(doc.fileKey) // best-effort
    return { deleted: true }
  }
}
