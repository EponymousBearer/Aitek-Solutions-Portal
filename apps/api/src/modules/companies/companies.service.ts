
import {
  CompanyMembershipRole,
  KYCStatus,
  OnboardingPhase,
  ProjectMembershipRole,
  ProjectStatus,
  UserRole,
} from '@aitek/types'
import type { AuthUser, CreateCompanyInput, UpdateCompanyInput } from '@aitek/types'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'
import { AuthService } from '../auth/auth.service'
import { ClerkMetadataSyncService } from '../auth/clerk-metadata-sync.service'
import { EmailService } from '../notifications/email.service'
import { assertPhaseEditable, computeProgress } from '../onboarding/onboarding-phase'

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name)

  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private metadataSync: ClerkMetadataSyncService,
    private emailService: EmailService,
  ) {}

  // ─── Admin: pending-approval queue ─────────────────────────────────────────

  private assertAitekTeam(user: AuthUser): void {
    if (user.role !== UserRole.AITEK_ADMIN && user.role !== UserRole.AITEK_TEAM_MEMBER) {
      throw new ForbiddenException('AiTek team access required')
    }
  }

  private clientListInclude = {
    memberships: {
      where: { isActive: true, role: CompanyMembershipRole.CLIENT_ADMIN },
      take: 1,
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    },
    _count: { select: { selectedServices: true } },
  } as const

  async listPendingApprovals(user: AuthUser) {
    this.assertAitekTeam(user)

    return this.prisma.company.findMany({
      where: {
        portalAccessGranted: false,
        onboardingPhase: OnboardingPhase.SUBMITTED,
      },
      include: this.clientListInclude,
      orderBy: { submittedForReviewAt: 'desc' },
    })
  }

  // Admin: full detail for a single client — everything they submitted across
  // onboarding (company profile, KYC docs, selected services, questionnaire
  // answers) plus the derived progress.
  async getCompanyDetail(companyId: string, user: AuthUser) {
    this.assertAitekTeam(user)

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        memberships: {
          where: { isActive: true },
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
        selectedServices: {
          include: { service: { select: { id: true, name: true, slug: true } } },
        },
        customRequests: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        kycSubmissions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { documents: { orderBy: { createdAt: 'asc' } } },
        },
        onboardingSessions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            responses: {
              include: {
                answers: {
                  include: { question: { select: { id: true, text: true, sortOrder: true } } },
                  orderBy: { question: { sortOrder: 'asc' } },
                },
                template: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    })
    if (!company) throw new NotFoundException('Company not found')

    return { ...company, progress: computeProgress(company) }
  }

  // Admin onboarding overview: every company that has started onboarding, with a
  // derived progress checklist + overall % so admins can see how far each got.
  async listOnboardingClients(user: AuthUser) {
    this.assertAitekTeam(user)

    const companies = await this.prisma.company.findMany({
      where: { deletedAt: null },
      include: this.clientListInclude,
      orderBy: { createdAt: 'desc' },
    })

    return companies.map((c) => ({ ...c, progress: computeProgress(c) }))
  }

  // Admin "request changes": re-open a single submitted phase for the client to
  // fix. Clears the finalized timestamp; for KYC also resets the latest
  // submission to PENDING so documents can be replaced.
  async reopenPhase(companyId: string, phase: OnboardingPhase, user: AuthUser) {
    this.assertAitekTeam(user)

    const reopenable: OnboardingPhase[] = [
      OnboardingPhase.COMPANY,
      OnboardingPhase.KYC,
      OnboardingPhase.SERVICES,
      OnboardingPhase.QUESTIONNAIRE,
    ]
    if (!reopenable.includes(phase)) {
      throw new BadRequestException('That phase cannot be reopened')
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        memberships: {
          where: { isActive: true, role: CompanyMembershipRole.CLIENT_ADMIN },
          take: 1,
          include: { user: { select: { email: true, firstName: true } } },
        },
      },
    })
    if (!company) throw new NotFoundException('Company not found')

    await this.prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: companyId },
        data: {
          onboardingPhase: phase,
          submittedForReviewAt: null,
          portalAccessGranted: false,
          ...(phase === OnboardingPhase.KYC
            ? { kycStatus: KYCStatus.RESUBMISSION_REQUIRED }
            : {}),
        },
      })

      if (phase === OnboardingPhase.KYC) {
        const latest = await tx.kYCSubmission.findFirst({
          where: { companyId },
          orderBy: { createdAt: 'desc' },
        })
        if (latest) {
          await tx.kYCSubmission.update({
            where: { id: latest.id },
            data: { status: KYCStatus.PENDING, resubmissionCount: { increment: 1 } },
          })
        }
      }
    })

    const admin = company.memberships[0]?.user
    if (admin) {
      const onboardingUrl = `${process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'}/onboarding`
      void this.emailService.sendChangesRequestedEmail(
        admin.email,
        admin.firstName,
        phase,
        onboardingUrl,
      )
    }

    this.logger.log(`Reopened phase=${phase} for company=${companyId} by user=${user.id}`)
    return { reopened: true, phase }
  }

  async approveCompany(companyId: string, user: AuthUser) {
    this.assertAitekTeam(user)

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        memberships: {
          where: { isActive: true, role: CompanyMembershipRole.CLIENT_ADMIN },
          take: 1,
          include: {
            user: { select: { id: true, email: true, firstName: true } },
          },
        },
      },
    })
    if (!company) throw new NotFoundException('Company not found')
    if (company.portalAccessGranted) {
      throw new ConflictException('Company is already approved')
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: companyId },
        data: { portalAccessGranted: true, kycStatus: KYCStatus.APPROVED },
      })
      // Keep the KYC submission in sync so it leaves the review queue.
      await tx.kYCSubmission.updateMany({
        where: { companyId, status: { in: [KYCStatus.UNDER_REVIEW, KYCStatus.PENDING] } },
        data: { status: KYCStatus.APPROVED, reviewedById: user.id, reviewedAt: new Date() },
      })
      // PRD flow: Admin Review → Project Creation → Portal Access. Seed the
      // client's first project from the onboarding (only if they have none yet).
      const existingProject = await tx.project.findFirst({
        where: { companyId, deletedAt: null },
        select: { id: true },
      })
      if (!existingProject) {
        const project = await tx.project.create({
          data: {
            companyId,
            name: company.name,
            slug: this.generateSlug(company.name),
            description: 'Initial engagement created from onboarding.',
            status: ProjectStatus.DISCOVERY,
            createdById: user.id,
          },
        })
        // Assign the onboarding client (company owner/admin) to their own
        // project as a stakeholder, so it shows up in their portal by default.
        const owners = await tx.companyMembership.findMany({
          where: { companyId, isActive: true, role: CompanyMembershipRole.CLIENT_ADMIN },
          select: { userId: true },
        })
        if (owners.length > 0) {
          await tx.projectMembership.createMany({
            data: owners.map((o) => ({
              projectId: project.id,
              userId: o.userId,
              role: ProjectMembershipRole.CLIENT_STAKEHOLDER,
              addedById: user.id,
            })),
            skipDuplicates: true,
          })
        }
      }
    })

    const admin = company.memberships[0]?.user
    if (admin) {
      const portalUrl = `${process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'}/portal`
      // Don't fail the approval if email send fails — log only.
      void this.emailService.sendApprovalEmail(admin.email, admin.firstName, portalUrl)
    }

    return { approved: true }
  }

  async createCompany(input: CreateCompanyInput, user: AuthUser) {
    // A brand-new client can reach onboarding before their DB user row exists —
    // the Clerk user.created webhook may not be configured/delivered on dev, so
    // ClerkAuthGuard falls back to the Clerk id for user.id. Self-heal the row
    // (getUserContext creates it if missing) and use its real id; otherwise the
    // membership below violates company_memberships_userId_fkey.
    const { id: userId } = await this.authService.getUserContext(user.clerkId)

    const existing = await this.prisma.companyMembership.findFirst({
      where: { userId, isActive: true },
    })
    if (existing) throw new ConflictException('User already belongs to a company')

    const slug = this.generateSlug(input.name)

    const company = await this.prisma.$transaction(async (tx) => {
      const created = await tx.company.create({
        data: {
          name: input.name,
          slug,
          businessType: input.businessType,
          industry: input.industry,
          employeeCount: input.employeeCount,
          country: input.country,
          state: input.state,
          website: input.website || undefined,
          socialLinks: input.socialLinks ?? undefined,
          existingSoftwareStack: input.existingSoftwareStack ?? undefined,
          annualRevenueRange: input.annualRevenueRange,
          yearsInBusiness: input.yearsInBusiness,
          // Portal access is granted by an AITEK_ADMIN via /companies/:id/approve
          // after they review the full onboarding (company + KYC + service +
          // questionnaire). Until then the user is held on /onboarding/pending.
          portalAccessGranted: false,
        },
      })

      await tx.companyMembership.create({
        data: {
          userId,
          companyId: created.id,
          role: CompanyMembershipRole.CLIENT_ADMIN,
          isActive: true,
        },
      })

      return created
    })

    // Sync claims AFTER the DB transaction commits so the network call doesn't
    // hold a Postgres lock.
    await this.metadataSync.sync(user.clerkId, {
      companyId: company.id,
      companyMembershipRole: CompanyMembershipRole.CLIENT_ADMIN,
    })

    return company
  }

  async getMyCompany(user: AuthUser) {
    if (!user.companyId) throw new NotFoundException('No company found for this user')
    return this.prisma.company.findUniqueOrThrow({ where: { id: user.companyId } })
  }

  async updateMyCompany(input: UpdateCompanyInput, user: AuthUser) {
    if (!user.companyId) throw new NotFoundException('No company found for this user')
    if (user.companyMembershipRole !== CompanyMembershipRole.CLIENT_ADMIN) {
      throw new ForbiddenException('Only company admins can update company profile')
    }

    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: user.companyId },
      select: { onboardingPhase: true },
    })
    assertPhaseEditable(company, OnboardingPhase.COMPANY)

    return this.prisma.company.update({
      where: { id: user.companyId },
      data: {
        ...input,
        website: input.website || undefined,
        socialLinks: input.socialLinks ?? undefined,
        existingSoftwareStack: input.existingSoftwareStack ?? undefined,
      },
    })
  }

  async getMembers(user: AuthUser) {
    if (!user.companyId) throw new NotFoundException('No company found for this user')

    return this.prisma.companyMembership.findMany({
      where: { companyId: user.companyId, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            status: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    })
  }

  async inviteMember(
    email: string,
    role: CompanyMembershipRole,
    user: AuthUser,
  ): Promise<{ token: string; inviteUrl: string }> {
    if (!user.companyId) throw new NotFoundException('No company found for this user')
    if (user.companyMembershipRole !== CompanyMembershipRole.CLIENT_ADMIN) {
      throw new ForbiddenException('Only company admins can invite members')
    }

    const token = this.authService.createInviteToken(email, role, user.companyId)
    const inviteUrl = `${process.env['NEXT_PUBLIC_APP_URL']}/invite/${token}`
    return { token, inviteUrl }
  }

  async removeMember(targetUserId: string, user: AuthUser): Promise<void> {
    if (!user.companyId) throw new NotFoundException('No company found for this user')
    if (user.companyMembershipRole !== CompanyMembershipRole.CLIENT_ADMIN) {
      throw new ForbiddenException('Only company admins can remove members')
    }
    if (targetUserId === user.id) {
      throw new ForbiddenException('Cannot remove yourself from the company')
    }

    const membership = await this.prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId: targetUserId, companyId: user.companyId } },
    })
    if (!membership || !membership.isActive) {
      throw new NotFoundException('Member not found in this company')
    }

    await this.prisma.companyMembership.update({
      where: { userId_companyId: { userId: targetUserId, companyId: user.companyId } },
      data: { isActive: false },
    })
  }

  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    const suffix = Math.random().toString(36).slice(2, 7)
    return `${base}-${suffix}`
  }
}
