import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'

import { CompanyMembershipRole } from '@aitek/types'
import type { AuthUser, CreateCompanyInput, UpdateCompanyInput } from '@aitek/types'

import { PrismaService } from '../../prisma/prisma.service'
import { AuthService } from '../auth/auth.service'

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  async createCompany(input: CreateCompanyInput, user: AuthUser) {
    const existing = await this.prisma.companyMembership.findFirst({
      where: { userId: user.id, isActive: true },
    })
    if (existing) throw new ConflictException('User already belongs to a company')

    const slug = this.generateSlug(input.name)

    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
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
        },
      })

      await tx.companyMembership.create({
        data: {
          userId: user.id,
          companyId: company.id,
          role: CompanyMembershipRole.CLIENT_ADMIN,
          isActive: true,
        },
      })

      return company
    })
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
