
import { CompanyMembershipRole, OnboardingStatus, UserRole } from '@aitek/types'
import type { AuthUser, CreateCompanyInput, UpdateCompanyInput } from '@aitek/types'
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'
import { AuthService } from '../auth/auth.service'
import { ClerkMetadataSyncService } from '../auth/clerk-metadata-sync.service'
import { EmailService } from '../notifications/email.service'

@Injectable()
export class CompaniesService {
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

  async listPendingApprovals(user: AuthUser) {
    this.assertAitekTeam(user)

    return this.prisma.company.findMany({
      where: {
        portalAccessGranted: false,
        onboardingSessions: { some: { status: OnboardingStatus.COMPLETED } },
      },
      include: {
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
      },
      orderBy: { createdAt: 'desc' },
    })
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

    await this.prisma.company.update({
      where: { id: companyId },
      data: { portalAccessGranted: true, kycStatus: 'APPROVED' },
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
    const existing = await this.prisma.companyMembership.findFirst({
      where: { userId: user.id, isActive: true },
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
          userId: user.id,
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
