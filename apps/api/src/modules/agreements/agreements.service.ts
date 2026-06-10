import { createHash } from 'crypto'
import type { ReadStream } from 'fs'

import { AgreementStatus, DocumentAccessLevel, UserRole } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Cron, CronExpression } from '@nestjs/schedule'

import { StorageService } from '../../common/storage/storage.service'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectsService } from '../projects/projects.service'

// Signature data URL cap. PNGs from the signature pad are small (tens of KB);
// this just stops an oversized payload from bloating the audit row.
const MAX_SIGNATURE_BYTES = 1_500_000

// Attached agreement PDF size cap.
const MAX_DOC_BYTES = 20 * 1024 * 1024 // 20MB

const signerSelect = { id: true, firstName: true, lastName: true } as const

const agreementInclude = {
  company: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
  document: { select: { id: true, fileName: true, mimeType: true } },
  auditRecords: {
    orderBy: { acknowledgedAt: 'desc' as const },
    take: 1,
    include: { user: { select: signerSelect } },
  },
}

interface CreateInput {
  projectId?: string | null
  companyId?: string
  title: string
  description?: string | null
  body?: string | null
  expiresAt?: string | null
}

interface SignInput {
  signerName: string
  signatureImage?: string | null
}

@Injectable()
export class AgreementsService {
  constructor(
    private prisma: PrismaService,
    private projects: ProjectsService,
    private storage: StorageService,
    private events: EventEmitter2,
  ) {}

  private isAitek(user: AuthUser): boolean {
    return user.role === UserRole.AITEK_ADMIN || user.role === UserRole.AITEK_TEAM_MEMBER
  }

  private assertAitek(user: AuthUser): void {
    if (!this.isAitek(user)) {
      throw new ForbiddenException('Only the AiTek team can manage agreements')
    }
  }

  // Throws 404 if the user can't see this agreement. Project-scoped ones defer to
  // project visibility; company-scoped ones require the same company (or AiTek).
  private async assertCanView(agreement: { companyId: string; projectId: string | null }, user: AuthUser) {
    if (this.isAitek(user)) return
    if (agreement.projectId) {
      await this.projects.requireProjectAccess(agreement.projectId, user)
      return
    }
    if (user.companyId && user.companyId === agreement.companyId) return
    throw new NotFoundException('Agreement not found')
  }

  // List agreements. AiTek see everything (optionally scoped to a project);
  // clients see their own company's agreements.
  async list(user: AuthUser, opts: { projectId?: string }) {
    if (opts.projectId) {
      await this.projects.requireProjectAccess(opts.projectId, user)
      return this.prisma.agreement.findMany({
        where: { projectId: opts.projectId },
        orderBy: { createdAt: 'desc' },
        include: agreementInclude,
      })
    }
    if (this.isAitek(user)) {
      return this.prisma.agreement.findMany({
        orderBy: { createdAt: 'desc' },
        include: agreementInclude,
      })
    }
    if (!user.companyId) return []
    return this.prisma.agreement.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: 'desc' },
      include: agreementInclude,
    })
  }

  async getOne(id: string, user: AuthUser) {
    const agreement = await this.prisma.agreement.findUnique({
      where: { id },
      include: agreementInclude,
    })
    if (!agreement) throw new NotFoundException('Agreement not found')
    await this.assertCanView(agreement, user)
    return agreement
  }

  // Create + send in one step (AiTek only). projectId scopes it to a project and
  // derives the client company; otherwise companyId must be supplied directly.
  // An optional PDF is stored as a (client-visible) Document and linked.
  async create(user: AuthUser, input: CreateInput, file?: Express.Multer.File) {
    this.assertAitek(user)

    const title = input.title?.trim()
    const body = input.body?.trim() || null
    if (!title) throw new BadRequestException('A title is required')
    if (!body && !file) throw new BadRequestException('Provide agreement text or attach a PDF')

    if (file) {
      if (file.mimetype !== 'application/pdf') {
        throw new BadRequestException('Only PDF files are supported')
      }
      if (file.size > MAX_DOC_BYTES) throw new BadRequestException('PDF exceeds the 20MB limit')
    }

    let companyId = input.companyId
    let projectId: string | null = null
    if (input.projectId) {
      const project = await this.projects.requireProjectAccess(input.projectId, user)
      companyId = project.companyId
      projectId = project.id
    }
    if (!companyId) throw new BadRequestException('A project or company is required')

    let expiresAt: Date | null = null
    if (input.expiresAt) {
      const d = new Date(input.expiresAt)
      if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid expiry date')
      expiresAt = d
    }

    // Persist the PDF (if any) as a client-visible Document. No projectId, so it
    // surfaces only through the agreement, not the project's Documents list.
    let documentId: string | null = null
    if (file) {
      const key = this.storage.buildKey({ companyId, fileName: file.originalname })
      await this.storage.save(key, file.buffer)
      const doc = await this.prisma.document.create({
        data: {
          companyId,
          name: title,
          fileKey: key,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          accessLevel: DocumentAccessLevel.CLIENT_VISIBLE,
          uploadedById: user.id,
        },
      })
      documentId = doc.id
    }

    const agreement = await this.prisma.agreement.create({
      data: {
        companyId,
        projectId,
        documentId,
        title,
        description: input.description?.trim() || null,
        body,
        status: AgreementStatus.PENDING_ACKNOWLEDGMENT,
        createdById: user.id,
        sentAt: new Date(),
        expiresAt,
      },
      include: agreementInclude,
    })

    this.events.emit('agreement.sent', {
      agreementId: agreement.id,
      companyId,
      projectId,
      actorId: user.id,
    })

    return agreement
  }

  // Stream the attached PDF (access-checked). 404 if there's no document.
  async getDocumentForDownload(
    id: string,
    user: AuthUser,
  ): Promise<{ stream: ReadStream; fileName: string; mimeType: string; size: number }> {
    const agreement = await this.prisma.agreement.findUnique({
      where: { id },
      include: { document: true },
    })
    if (!agreement) throw new NotFoundException('Agreement not found')
    await this.assertCanView(agreement, user)
    if (!agreement.document) throw new NotFoundException('This agreement has no attached file')

    const { size } = await this.storage.stat(agreement.document.fileKey)
    return {
      stream: this.storage.createReadStream(agreement.document.fileKey),
      fileName: agreement.document.fileName,
      mimeType: agreement.document.mimeType,
      size,
    }
  }

  // Client signs: records the typed legal name + drawn signature, an integrity
  // hash of exactly what they signed (the PDF bytes if attached, else the body),
  // and the request's IP/UA for the audit.
  async sign(id: string, user: AuthUser, input: SignInput, meta: { ip: string; userAgent: string }) {
    if (this.isAitek(user)) {
      throw new ForbiddenException('AiTek team members cannot sign on the client’s behalf')
    }

    const agreement = await this.prisma.agreement.findUnique({
      where: { id },
      include: { document: true },
    })
    if (!agreement) throw new NotFoundException('Agreement not found')
    await this.assertCanView(agreement, user)

    if (agreement.status !== AgreementStatus.PENDING_ACKNOWLEDGMENT) {
      throw new BadRequestException('This agreement is not awaiting a signature')
    }
    if (agreement.expiresAt && agreement.expiresAt < new Date()) {
      await this.prisma.agreement.update({
        where: { id: agreement.id },
        data: { status: AgreementStatus.EXPIRED },
      })
      throw new BadRequestException('This agreement has expired')
    }

    const signerName = input.signerName?.trim()
    if (!signerName) throw new BadRequestException('Your full legal name is required')

    const signatureImage = input.signatureImage?.trim() || null
    if (!signatureImage) throw new BadRequestException('A signature is required')
    if (!signatureImage.startsWith('data:image/')) {
      throw new BadRequestException('Invalid signature image')
    }
    if (signatureImage.length > MAX_SIGNATURE_BYTES) {
      throw new BadRequestException('Signature image is too large')
    }

    // Hash exactly what was presented to the signer.
    const hash = createHash('sha256')
    if (agreement.document) {
      hash.update(await this.storage.readToBuffer(agreement.document.fileKey))
    } else {
      hash.update(agreement.body ?? '', 'utf8')
    }
    const documentHash = hash.digest('hex')

    await this.prisma.$transaction([
      this.prisma.agreementAuditRecord.create({
        data: {
          agreementId: agreement.id,
          userId: user.id,
          acknowledgedName: signerName,
          signatureImage,
          documentHash,
          ipAddress: meta.ip.slice(0, 100),
          userAgent: meta.userAgent.slice(0, 500),
        },
      }),
      this.prisma.agreement.update({
        where: { id: agreement.id },
        data: { status: AgreementStatus.ACKNOWLEDGED },
      }),
    ])

    this.events.emit('agreement.acknowledged', {
      agreementId: agreement.id,
      companyId: agreement.companyId,
      projectId: agreement.projectId,
      signerName,
      actorId: user.id,
    })

    return this.getOne(id, user)
  }

  // Delete an unsigned agreement (AiTek only). Signed agreements are immutable —
  // their audit record is a legal artefact.
  async remove(id: string, user: AuthUser) {
    this.assertAitek(user)
    const agreement = await this.prisma.agreement.findUnique({ where: { id } })
    if (!agreement) throw new NotFoundException('Agreement not found')
    if (agreement.status === AgreementStatus.ACKNOWLEDGED) {
      throw new BadRequestException('A signed agreement cannot be deleted')
    }
    await this.prisma.agreement.delete({ where: { id } })
    return { deleted: true }
  }

  // Client declines a pending agreement (with an optional reason). AiTek are
  // notified. Expired agreements can't be declined.
  async decline(id: string, user: AuthUser, input: { reason?: string | null }) {
    if (this.isAitek(user)) {
      throw new ForbiddenException('Only the client can decline an agreement')
    }
    const agreement = await this.prisma.agreement.findUnique({ where: { id } })
    if (!agreement) throw new NotFoundException('Agreement not found')
    await this.assertCanView(agreement, user)

    if (agreement.status !== AgreementStatus.PENDING_ACKNOWLEDGMENT) {
      throw new BadRequestException('This agreement is not awaiting a response')
    }
    if (agreement.expiresAt && agreement.expiresAt < new Date()) {
      await this.prisma.agreement.update({
        where: { id: agreement.id },
        data: { status: AgreementStatus.EXPIRED },
      })
      throw new BadRequestException('This agreement has expired')
    }

    await this.prisma.agreement.update({
      where: { id: agreement.id },
      data: {
        status: AgreementStatus.REJECTED,
        declineReason: input.reason?.trim() || null,
      },
    })

    this.events.emit('agreement.declined', {
      agreementId: agreement.id,
      companyId: agreement.companyId,
      projectId: agreement.projectId,
      actorId: user.id,
    })

    return this.getOne(id, user)
  }

  // AiTek revokes a still-pending agreement (marks it EXPIRED). Signed agreements
  // are immutable; declined/expired ones are already closed.
  async expire(id: string, user: AuthUser) {
    this.assertAitek(user)
    const agreement = await this.prisma.agreement.findUnique({ where: { id } })
    if (!agreement) throw new NotFoundException('Agreement not found')
    if (agreement.status !== AgreementStatus.PENDING_ACKNOWLEDGMENT) {
      throw new BadRequestException('Only a pending agreement can be revoked')
    }
    await this.prisma.agreement.update({
      where: { id },
      data: { status: AgreementStatus.EXPIRED },
    })
    return this.getOne(id, user)
  }

  // Auto-expire pending agreements whose deadline has passed. Hourly is plenty;
  // sign()/decline() also guard at the moment of action.
  @Cron(CronExpression.EVERY_HOUR)
  async expireOverdue(): Promise<void> {
    await this.prisma.agreement.updateMany({
      where: { status: AgreementStatus.PENDING_ACKNOWLEDGMENT, expiresAt: { lt: new Date() } },
      data: { status: AgreementStatus.EXPIRED },
    })
  }
}
