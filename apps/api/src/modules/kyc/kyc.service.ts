import type { ReadStream } from 'fs'

import { CompanyMembershipRole, KYCDocumentCategory, KYCStatus, OnboardingPhase, UserRole } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'

import { StorageService } from '../../common/storage/storage.service'
import { PrismaService } from '../../prisma/prisma.service'
import { EmailService } from '../notifications/email.service'
import { advancePhase, assertPhaseEditable } from '../onboarding/onboarding-phase'

const MAX_KYC_BYTES = 15 * 1024 * 1024 // 15MB
const ALLOWED_KYC_MIME = ['application/pdf', 'image/png', 'image/jpeg']

@Injectable()
export class KycService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private emailService: EmailService,
  ) {}

  private assertAitekTeam(user: AuthUser): void {
    if (user.role !== UserRole.AITEK_ADMIN && user.role !== UserRole.AITEK_TEAM_MEMBER) {
      throw new ForbiddenException('AiTek team access required')
    }
  }

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

  async addDocument(
    category: KYCDocumentCategory,
    file: Express.Multer.File | undefined,
    user: AuthUser,
  ) {
    if (!user.companyId) throw new ForbiddenException('User has no company')
    if (!file) throw new BadRequestException('No file provided')
    if (!file.size || file.size <= 0) throw new BadRequestException('File is empty')
    if (file.size > MAX_KYC_BYTES) throw new BadRequestException('File exceeds the 15MB limit')
    if (!ALLOWED_KYC_MIME.includes(file.mimetype)) {
      throw new BadRequestException('Only PDF, PNG, or JPEG files are accepted')
    }

    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: user.companyId },
      select: { onboardingPhase: true },
    })
    assertPhaseEditable(company, OnboardingPhase.KYC)

    const submission = await this.ensureSubmission(user)
    // Block re-upload only while actively in the KYC phase with a non-PENDING
    // submission. During the final REVIEW pass we allow replacing documents.
    if (company.onboardingPhase === OnboardingPhase.KYC && submission.status !== KYCStatus.PENDING) {
      throw new BadRequestException(
        `Cannot add documents — submission is ${submission.status}, not PENDING`,
      )
    }

    // One doc per category per submission: remove the previous one (and its file)
    // before saving the new upload.
    const previous = await this.prisma.kYCDocument.findMany({
      where: { kycSubmissionId: submission.id, category },
      select: { fileKey: true },
    })
    await this.prisma.kYCDocument.deleteMany({
      where: { kycSubmissionId: submission.id, category },
    })
    for (const p of previous) void this.storage.delete(p.fileKey)

    const key = this.storage.buildKey({
      companyId: user.companyId,
      fileName: file.originalname,
      prefix: 'kyc',
    })
    await this.storage.save(key, file.buffer)

    return this.prisma.kYCDocument.create({
      data: {
        kycSubmissionId: submission.id,
        category,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        fileKey: key,
        uploadedById: user.id,
      },
    })
  }

  // Stream a KYC document for review/download. AiTek team see any; a client sees
  // only their own company's documents.
  async getDocumentForDownload(
    documentId: string,
    user: AuthUser,
  ): Promise<{ stream: ReadStream; fileName: string; mimeType: string; size: number }> {
    const doc = await this.prisma.kYCDocument.findUnique({
      where: { id: documentId },
      include: { submission: { select: { companyId: true } } },
    })
    if (!doc) throw new NotFoundException('Document not found')

    const isAitek =
      user.role === UserRole.AITEK_ADMIN || user.role === UserRole.AITEK_TEAM_MEMBER
    if (!isAitek && user.companyId !== doc.submission.companyId) {
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

  async submitForReview(user: AuthUser) {
    if (!user.companyId) throw new ForbiddenException('User has no company')

    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: user.companyId },
      select: { onboardingPhase: true },
    })
    assertPhaseEditable(company, OnboardingPhase.KYC)

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

    // Advance the onboarding pointer (KYC → next incomplete phase). When this is
    // a post-review resubmission, advancePhase fast-forwards straight to REVIEW.
    const phase = await advancePhase(this.prisma, user.companyId, OnboardingPhase.KYC)

    return { submitted: true, status: KYCStatus.UNDER_REVIEW, phase }
  }

  // ─── Admin review queue ─────────────────────────────────────────────────────

  // Submissions awaiting an admin decision, with the uploaded documents and the
  // submitting company's primary contact.
  async listSubmissionsForReview(user: AuthUser) {
    this.assertAitekTeam(user)
    return this.prisma.kYCSubmission.findMany({
      // Awaiting review, excluding companies that have already been fully approved.
      where: { status: KYCStatus.UNDER_REVIEW, company: { portalAccessGranted: false } },
      orderBy: { submittedAt: 'desc' },
      include: {
        documents: { orderBy: { createdAt: 'asc' } },
        company: {
          select: {
            id: true,
            name: true,
            onboardingPhase: true,
            memberships: {
              where: { isActive: true, role: CompanyMembershipRole.CLIENT_ADMIN },
              take: 1,
              include: { user: { select: { email: true, firstName: true, lastName: true } } },
            },
          },
        },
      },
    })
  }

  async approveSubmission(submissionId: string, user: AuthUser) {
    this.assertAitekTeam(user)
    const submission = await this.prisma.kYCSubmission.findUnique({
      where: { id: submissionId },
      select: { id: true, companyId: true },
    })
    if (!submission) throw new NotFoundException('Submission not found')

    await this.prisma.$transaction([
      this.prisma.kYCSubmission.update({
        where: { id: submission.id },
        data: { status: KYCStatus.APPROVED, reviewedById: user.id, reviewedAt: new Date() },
      }),
      this.prisma.company.update({
        where: { id: submission.companyId },
        data: { kycStatus: KYCStatus.APPROVED },
      }),
    ])
    return { status: KYCStatus.APPROVED }
  }

  // Send a submission back for changes: reset it to PENDING so the client can
  // replace documents, mark the company RESUBMISSION_REQUIRED, and bounce the
  // onboarding pointer back to the KYC phase.
  async requestResubmission(submissionId: string, user: AuthUser, notes?: string) {
    this.assertAitekTeam(user)
    const submission = await this.prisma.kYCSubmission.findUnique({
      where: { id: submissionId },
      include: {
        company: {
          select: {
            id: true,
            memberships: {
              where: { isActive: true, role: CompanyMembershipRole.CLIENT_ADMIN },
              take: 1,
              include: { user: { select: { email: true, firstName: true } } },
            },
          },
        },
      },
    })
    if (!submission) throw new NotFoundException('Submission not found')

    await this.prisma.$transaction([
      this.prisma.kYCSubmission.update({
        where: { id: submission.id },
        data: {
          status: KYCStatus.PENDING,
          reviewedById: user.id,
          reviewedAt: new Date(),
          reviewNotes: notes ?? null,
          resubmissionCount: { increment: 1 },
        },
      }),
      this.prisma.company.update({
        where: { id: submission.companyId },
        data: {
          kycStatus: KYCStatus.RESUBMISSION_REQUIRED,
          onboardingPhase: OnboardingPhase.KYC,
          submittedForReviewAt: null,
          portalAccessGranted: false,
        },
      }),
    ])

    const admin = submission.company.memberships[0]?.user
    if (admin) {
      const onboardingUrl = `${process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'}/onboarding`
      void this.emailService.sendChangesRequestedEmail(
        admin.email,
        admin.firstName,
        'Identity verification',
        onboardingUrl,
      )
    }
    return { status: KYCStatus.RESUBMISSION_REQUIRED }
  }
}
