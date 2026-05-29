import {
  CompanyMembershipRole,
  KYCStatus,
  OnboardingPhase,
  OnboardingStatus,
  UserRole,
} from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import * as jwt from 'jsonwebtoken'


import { PrismaService } from '../../prisma/prisma.service'

import { ClerkMetadataSyncService } from './clerk-metadata-sync.service'

interface InviteTokenPayload {
  email: string
  companyId?: string
  membershipRole: CompanyMembershipRole
  type: 'company_invite' | 'aitek_invite'
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private metadataSync: ClerkMetadataSyncService,
  ) {}

  private userContextInclude = {
    companyMemberships: {
      where: { isActive: true },
      take: 1,
      include: {
        company: {
          select: {
            id: true,
            kycStatus: true,
            portalAccessGranted: true,
            onboardingPhase: true,
            _count: { select: { selectedServices: true } },
            onboardingSessions: {
              where: { status: OnboardingStatus.COMPLETED },
              take: 1,
              select: { id: true },
            },
          },
        },
      },
    },
  } as const

  // Full /auth/me payload: base identity + derived onboarding state.
  // Derived fields are NOT in the JWT; they are computed here so PortalGuard
  // can route incomplete users to the right onboarding step.
  async getUserContext(clerkId: string): Promise<AuthUser> {
    let user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: this.userContextInclude,
    })

    if (!user) {
      // Webhook hasn't fired (local dev without ngrok, or race with first /auth/me).
      // Self-heal: fetch identity from Clerk and create the DB row exactly as
      // handleUserCreated would.
      const clerkUser = await this.metadataSync.getClerkUser(clerkId)
      if (!clerkUser) throw new UnauthorizedException('User not found')

      await this.handleUserCreated({
        id: clerkId,
        email_addresses: [{ email_address: clerkUser.email }],
        first_name: clerkUser.firstName,
        last_name: clerkUser.lastName,
      })

      user = await this.prisma.user.findUnique({
        where: { clerkId },
        include: this.userContextInclude,
      })
      if (!user) throw new UnauthorizedException('User not found')
    }

    const membership = user.companyMemberships[0]
    const company = membership?.company

    return {
      id: user.id,
      clerkId: user.clerkId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as UserRole,
      companyId: membership?.companyId,
      companyMembershipRole: membership?.role as CompanyMembershipRole | undefined,
      portalAccessGranted: company?.portalAccessGranted ?? false,
      kycStatus: (company?.kycStatus as KYCStatus | undefined) ?? KYCStatus.NOT_STARTED,
      hasSelectedServices: (company?._count?.selectedServices ?? 0) > 0,
      onboardingComplete: (company?.onboardingSessions?.length ?? 0) > 0,
      onboardingPhase: (company?.onboardingPhase as OnboardingPhase | undefined) ?? undefined,
    }
  }

  async handleUserCreated(data: {
    id: string
    email_addresses: Array<{ email_address: string }>
    first_name: string | null
    last_name: string | null
  }): Promise<void> {
    const email = data.email_addresses[0]?.email_address ?? ''

    // Match an admin pre-seeded by ADMIN_EMAIL: if a User row already exists
    // for this email with AITEK_ADMIN role and a synthetic seed clerkId, bind
    // it to the real Clerk id now. Otherwise create a regular CLIENT_USER.
    const existing = await this.prisma.user.findUnique({ where: { email } })
    let role: UserRole = UserRole.CLIENT_USER

    if (existing && existing.clerkId.startsWith('seed-admin-')) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          clerkId: data.id,
          firstName: data.first_name ?? existing.firstName,
          lastName: data.last_name ?? existing.lastName,
        },
      })
      role = existing.role as UserRole
    } else {
      await this.prisma.user.upsert({
        where: { clerkId: data.id },
        update: {},
        create: {
          clerkId: data.id,
          email,
          firstName: data.first_name ?? '',
          lastName: data.last_name ?? '',
          role: UserRole.CLIENT_USER,
        },
      })
    }

    await this.metadataSync.sync(data.id, { role })
  }

  async handleUserDeleted(clerkId: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: { clerkId, deletedAt: null },
      data: { deletedAt: new Date() },
    })
  }

  createInviteToken(
    email: string,
    membershipRole: CompanyMembershipRole,
    companyId?: string,
  ): string {
    const payload: InviteTokenPayload = {
      email,
      companyId,
      membershipRole,
      type: companyId ? 'company_invite' : 'aitek_invite',
    }
    return jwt.sign(payload, process.env['JWT_SECRET']!, { expiresIn: '7d' })
  }

  validateInviteToken(token: string): InviteTokenPayload {
    try {
      return jwt.verify(token, process.env['JWT_SECRET']!) as InviteTokenPayload
    } catch {
      throw new BadRequestException('Invalid or expired invite token')
    }
  }

  async acceptInvite(token: string, currentUser: AuthUser): Promise<void> {
    const payload = this.validateInviteToken(token)

    if (payload.email !== currentUser.email) {
      throw new ForbiddenException('This invite was not issued for your email address')
    }
    if (!payload.companyId) {
      throw new BadRequestException('Invite has no company association')
    }

    const existing = await this.prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId: currentUser.id, companyId: payload.companyId } },
    })

    if (existing?.isActive) {
      throw new ConflictException('You are already a member of this company')
    }

    await this.prisma.companyMembership.upsert({
      where: { userId_companyId: { userId: currentUser.id, companyId: payload.companyId } },
      update: { isActive: true, role: payload.membershipRole },
      create: {
        userId: currentUser.id,
        companyId: payload.companyId,
        role: payload.membershipRole,
        isActive: true,
      },
    })

    await this.metadataSync.sync(currentUser.clerkId, {
      companyId: payload.companyId,
      companyMembershipRole: payload.membershipRole,
    })
  }
}
