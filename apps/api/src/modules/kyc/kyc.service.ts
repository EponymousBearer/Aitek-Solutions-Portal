
import { CompanyMembershipRole, KYCDocumentCategory, KYCStatus, OnboardingPhase, UserRole } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'
import { EmailService } from '../notifications/email.service'
import { advancePhase, assertPhaseEditable } from '../onboarding/onboarding-phase'

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
  constructor(
    private prisma: PrismaService,
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

  async addDocument(input: CreateDocumentInput, user: AuthUser) {
    if (!user.companyId) throw new ForbiddenException('User has no company')

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
