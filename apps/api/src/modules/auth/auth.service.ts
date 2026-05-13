import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuthUser } from '@aitek/types'
import { UserRole, CompanyMembershipRole } from '@aitek/types'

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async getUserContext(clerkId: string): Promise<AuthUser> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.prisma as any

    const user = await db.user.findUnique({
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
}
