import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'

import { KYCDocumentCategory, KYCStatus } from '@aitek/types'
import type { AuthUser } from '@aitek/types'

import { PrismaService } from '../../prisma/prisma.service'

interface CreateDocumentInput {
  category: KYCDocumentCategory
  fileName: string
  fileSize: number
  mimeType: string
}

// STUB module — accepts file metadata only. No R2 upload, no admin review
// queue. fileKey is a synthetic "stub:" URI so the row is valid. Real KYC
// processing (R2 upload, admin queue, AI risk flags, signed URLs) lands in
// Prompt 6 (see planning/15-hostinger-vps-deployment-plan.md + planning/12).
@Injectable()
export class KycService {
  constructor(private prisma: PrismaService) {}

  private async ensureSubmission(user: AuthUser) {
    if (!user.companyId) throw new ForbiddenException('User has no company')

    const existing = await this.prisma.kYCSubmission.findFirst({
      where: { companyId: user.companyId },
      include: { documents: true },
      orderBy: { createdAt: 'desc' },
    })
    if (existing) return existing

    return this.prisma.kYCSubmission.create({
      data: {
        companyId: user.companyId,
        submittedById: user.id,
        status: KYCStatus.PENDING,
      },
      include: { documents: true },
    })
  }

  async getMine(user: AuthUser) {
    if (!user.companyId) return null
    return this.prisma.kYCSubmission.findFirst({
      where: { companyId: user.companyId },
      include: { documents: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  async createSubmission(user: AuthUser) {
    return this.ensureSubmission(user)
  }

  async addDocument(input: CreateDocumentInput, user: AuthUser) {
    const submission = await this.ensureSubmission(user)
    if (submission.status !== KYCStatus.PENDING) {
      throw new BadRequestException(
        `Cannot add documents — submission is ${submission.status}, not PENDING`,
      )
    }

    // Replace any existing document for this category (one doc per category per submission).
    await this.prisma.kYCDocument.deleteMany({
      where: { kycSubmissionId: submission.id, category: input.category },
    })

    const cuid = `stub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

    return this.prisma.kYCDocument.create({
      data: {
        kycSubmissionId: submission.id,
        category: input.category,
        fileName: input.fileName,
        fileSize: input.fileSize,
        mimeType: input.mimeType,
        fileKey: `stub:${cuid}`,
        uploadedById: user.id,
      },
    })
  }

  async submitForReview(user: AuthUser) {
    if (!user.companyId) throw new ForbiddenException('User has no company')

    const submission = await this.prisma.kYCSubmission.findFirst({
      where: { companyId: user.companyId },
      include: { documents: true },
      orderBy: { createdAt: 'desc' },
    })
    if (!submission) throw new NotFoundException('No submission to submit')

    const required: KYCDocumentCategory[] = [
      KYCDocumentCategory.BUSINESS_REGISTRATION,
      KYCDocumentCategory.TAX_ID,
      KYCDocumentCategory.GOVERNMENT_ID,
      KYCDocumentCategory.ADDRESS_PROOF,
    ]
    const uploadedCategories = new Set(submission.documents.map((d) => d.category))
    const missing = required.filter((c) => !uploadedCategories.has(c))
    if (missing.length > 0) {
      throw new BadRequestException(`Missing required documents: ${missing.join(', ')}`)
    }

    await this.prisma.$transaction([
      this.prisma.kYCSubmission.update({
        where: { id: submission.id },
        data: { status: KYCStatus.UNDER_REVIEW, submittedAt: new Date() },
      }),
      this.prisma.company.update({
        where: { id: user.companyId },
        data: { kycStatus: KYCStatus.UNDER_REVIEW },
      }),
    ])

    return { submitted: true, status: KYCStatus.UNDER_REVIEW }
  }
}
