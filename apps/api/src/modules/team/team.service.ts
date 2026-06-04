import { AitekRole, UserRole } from '@aitek/types'
import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class TeamService {
  constructor(private prisma: PrismaService) {}

  // All AiTek internal team members (admins + project managers + developers),
  // optionally filtered to a single AiTek sub-role. Used to populate the
  // "assign lead" / "add developer" pickers.
  async list(aitekRole?: AitekRole) {
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [{ role: UserRole.AITEK_ADMIN }, { role: UserRole.AITEK_TEAM_MEMBER }],
        ...(aitekRole ? { aitekRole } : {}),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        aitekRole: true,
        createdAt: true,
      },
      orderBy: [{ firstName: 'asc' }, { email: 'asc' }],
    })
  }
}
