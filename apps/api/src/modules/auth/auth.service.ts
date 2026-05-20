import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import * as jwt from 'jsonwebtoken'

import { CompanyMembershipRole, UserRole } from '@aitek/types'
import type { AuthUser } from '@aitek/types'

import { PrismaService } from '../../prisma/prisma.service'

interface InviteTokenPayload {
  email: string
  companyId?: string
  membershipRole: CompanyMembershipRole
  type: 'company_invite' | 'aitek_invite'
}

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async getUserContext(clerkId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: {
        companyMemberships: {
          where: { isActive: true },
          take: 1,
        },
      },
    })

    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    const membership = user.companyMemberships[0]

    return {
      id: user.id,
      clerkId: user.clerkId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as UserRole,
      companyId: membership?.companyId ?? undefined,
      companyMembershipRole: membership?.role as CompanyMembershipRole | undefined,
    }
  }

  async handleUserCreated(data: {
    id: string
    email_addresses: Array<{ email_address: string }>
    first_name: string | null
    last_name: string | null
  }): Promise<void> {
    await this.prisma.user.upsert({
      where: { clerkId: data.id },
      update: {},
      create: {
        clerkId: data.id,
        email: data.email_addresses[0]?.email_address ?? '',
        firstName: data.first_name ?? '',
        lastName: data.last_name ?? '',
        role: UserRole.CLIENT_USER,
      },
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
  }
}
