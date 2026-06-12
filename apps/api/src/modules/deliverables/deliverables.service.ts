import type { ReadStream } from 'fs'

import { DeliverableStatus } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'

import { StorageService } from '../../common/storage/storage.service'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectsService } from '../projects/projects.service'

const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50MB per file
const MAX_FILES = 10

interface CreateInput {
  title: string
  description?: string | null
  url?: string | null
  status?: DeliverableStatus
}

interface UpdateInput {
  title?: string
  description?: string | null
  url?: string | null
  status?: DeliverableStatus
}

// Include the attached files (newest last) on every deliverable we return.
const withFiles = {
  files: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      createdAt: true,
    },
  },
}

@Injectable()
export class DeliverablesService {
  constructor(
    private prisma: PrismaService,
    private projects: ProjectsService,
    private storage: StorageService,
    private events: EventEmitter2,
  ) {}

  // Tell the client side a deliverable is ready (in-app + realtime + email).
  private emitDelivered(projectId: string, companyId: string, title: string, actorId: string) {
    this.events.emit('deliverable.delivered', { projectId, companyId, title, actorId })
  }

  // Everyone who can see the project sees its deliverables. `canManage` tells the
  // UI whether to show add/edit controls (admin or the lead PM).
  async list(projectId: string, user: AuthUser) {
    await this.projects.requireProjectAccess(projectId, user)
    const [deliverables, canManage] = await Promise.all([
      this.prisma.deliverable.findMany({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
        include: withFiles,
      }),
      this.projects.canManageProject(projectId, user),
    ])
    return { deliverables, canManage }
  }

  private normalizeUrl(url?: string | null): string | null {
    const u = url?.trim()
    if (!u) return null
    if (!/^https?:\/\//i.test(u)) throw new BadRequestException('Link must start with http:// or https://')
    return u
  }

  // Validate + persist uploaded files to disk and return the rows to create.
  private async storeFiles(
    companyId: string,
    projectId: string,
    files: Express.Multer.File[],
    userId: string,
  ) {
    if (files.length > MAX_FILES) {
      throw new BadRequestException(`You can attach at most ${MAX_FILES} files`)
    }
    const rows: {
      fileKey: string
      fileName: string
      fileSize: number
      mimeType: string
      uploadedById: string
    }[] = []
    for (const file of files) {
      if (!file.size || file.size <= 0) throw new BadRequestException(`"${file.originalname}" is empty`)
      if (file.size > MAX_FILE_BYTES) {
        throw new BadRequestException(`"${file.originalname}" exceeds the 50MB limit`)
      }
      const key = this.storage.buildKey({
        companyId,
        projectId,
        fileName: file.originalname,
        prefix: 'deliverables',
      })
      await this.storage.save(key, file.buffer)
      rows.push({
        fileKey: key,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype || 'application/octet-stream',
        uploadedById: userId,
      })
    }
    return rows
  }

  async create(
    projectId: string,
    input: CreateInput,
    files: Express.Multer.File[],
    user: AuthUser,
  ) {
    const project = await this.projects.requireProjectAccess(projectId, user)
    await this.projects.requireProjectManage(projectId, user)

    const title = input.title?.trim()
    if (!title) throw new BadRequestException('A title is required')

    const fileRows = await this.storeFiles(project.companyId, projectId, files, user.id)

    const status = input.status === DeliverableStatus.DELIVERED ? DeliverableStatus.DELIVERED : DeliverableStatus.PENDING
    const deliverable = await this.prisma.deliverable.create({
      data: {
        projectId,
        title,
        description: input.description?.trim() || null,
        url: this.normalizeUrl(input.url),
        status,
        deliveredAt: status === DeliverableStatus.DELIVERED ? new Date() : null,
        createdById: user.id,
        files: fileRows.length ? { create: fileRows } : undefined,
      },
      include: withFiles,
    })
    if (status === DeliverableStatus.DELIVERED) {
      this.emitDelivered(projectId, project.companyId, title, user.id)
    }
    return deliverable
  }

  async update(
    projectId: string,
    id: string,
    input: UpdateInput,
    files: Express.Multer.File[],
    user: AuthUser,
  ) {
    const project = await this.projects.requireProjectAccess(projectId, user)
    await this.projects.requireProjectManage(projectId, user)

    const existing = await this.prisma.deliverable.findFirst({ where: { id, projectId } })
    if (!existing) throw new NotFoundException('Deliverable not found')

    const data: Record<string, unknown> = {}
    if (typeof input.title === 'string') {
      const t = input.title.trim()
      if (!t) throw new BadRequestException('A title is required')
      data['title'] = t
    }
    if (input.description !== undefined) data['description'] = input.description?.trim() || null
    if (input.url !== undefined) data['url'] = this.normalizeUrl(input.url)
    let justDelivered = false
    if (input.status && input.status !== existing.status) {
      data['status'] = input.status
      data['deliveredAt'] = input.status === DeliverableStatus.DELIVERED ? new Date() : null
      justDelivered = input.status === DeliverableStatus.DELIVERED
    }

    // Newly uploaded files are appended to the existing set.
    if (files.length) {
      const fileRows = await this.storeFiles(project.companyId, projectId, files, user.id)
      data['files'] = { create: fileRows }
    }

    const updated = await this.prisma.deliverable.update({
      where: { id },
      data,
      include: withFiles,
    })
    if (justDelivered) {
      this.emitDelivered(projectId, project.companyId, updated.title, user.id)
    }
    return updated
  }

  // Resolve an attached file for download after access checks. Anyone who can
  // see the project may download it.
  async openFile(
    projectId: string,
    deliverableId: string,
    fileId: string,
    user: AuthUser,
  ): Promise<{ stream: ReadStream; fileName: string; mimeType: string; size: number }> {
    await this.projects.requireProjectAccess(projectId, user)
    const file = await this.prisma.deliverableFile.findFirst({
      where: { id: fileId, deliverableId, deliverable: { projectId } },
    })
    if (!file) throw new NotFoundException('File not found')
    const { size } = await this.storage.stat(file.fileKey)
    return {
      stream: this.storage.createReadStream(file.fileKey),
      fileName: file.fileName,
      mimeType: file.mimeType,
      size,
    }
  }

  async removeFile(projectId: string, deliverableId: string, fileId: string, user: AuthUser) {
    await this.projects.requireProjectAccess(projectId, user)
    await this.projects.requireProjectManage(projectId, user)
    const file = await this.prisma.deliverableFile.findFirst({
      where: { id: fileId, deliverableId, deliverable: { projectId } },
    })
    if (!file) throw new NotFoundException('File not found')

    await this.prisma.deliverableFile.delete({ where: { id: fileId } })
    void this.storage.delete(file.fileKey) // best-effort
    return { deleted: true }
  }

  async remove(projectId: string, id: string, user: AuthUser) {
    await this.projects.requireProjectAccess(projectId, user)
    await this.projects.requireProjectManage(projectId, user)

    const existing = await this.prisma.deliverable.findFirst({
      where: { id, projectId },
      include: { files: { select: { fileKey: true } } },
    })
    if (!existing) throw new NotFoundException('Deliverable not found')

    // The file rows cascade-delete with the deliverable; remove the bytes too.
    await this.prisma.deliverable.delete({ where: { id } })
    for (const f of existing.files) void this.storage.delete(f.fileKey)
    return { deleted: true }
  }
}
