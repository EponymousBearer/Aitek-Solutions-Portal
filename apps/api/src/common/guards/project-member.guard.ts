import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { UserRole } from '@aitek/types'

@Injectable()
export class ProjectMemberGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const user = request.user
    const projectId = request.params?.projectId

    if (!projectId) return true

    if (user?.role === UserRole.AITEK_ADMIN) return true

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.prisma as any

    const membership = await db.projectMembership.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    })

    if (!membership) {
      throw new ForbiddenException('Not a member of this project')
    }

    return true
  }
}
