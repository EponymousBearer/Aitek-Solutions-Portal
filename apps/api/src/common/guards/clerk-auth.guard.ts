import type { AuthUser } from '@aitek/types'
import { UserRole, CompanyMembershipRole, AitekRole } from '@aitek/types'
import { verifyToken } from '@clerk/backend'
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'


import { PrismaService } from '../../prisma/prisma.service'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest()
    const authHeader = request.headers['authorization'] as string | undefined

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header')
    }

    const token = authHeader.slice(7)

    let payload
    try {
      payload = await verifyToken(token, {
        secretKey: process.env['CLERK_SECRET_KEY'] ?? '',
      })
    } catch {
      throw new UnauthorizedException('Invalid or expired token')
    }

    const clerkId = payload.sub

    // Hydrate from DB. The JWT can lag the DB (e.g. just after POST /companies
    // succeeds, the publicMetadata sync may not have propagated to the cached
    // session token yet). Treating DB as the source of truth here keeps every
    // downstream endpoint consistent.
    //
    // On the very first /auth/me the user row may not exist yet — /auth/me's
    // self-heal will create it. Fall back to clerkId so the guard still admits
    // that bootstrap call.
    const dbUser = await this.prisma.user.findUnique({
      where: { clerkId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        aitekRole: true,
        companyMemberships: {
          where: { isActive: true },
          take: 1,
          select: { companyId: true, role: true },
        },
      },
    })

    const membership = dbUser?.companyMemberships[0]

    const user: AuthUser = {
      id: dbUser?.id ?? clerkId,
      clerkId,
      email: dbUser?.email ?? (payload['email'] as string) ?? '',
      firstName: dbUser?.firstName ?? (payload['firstName'] as string) ?? '',
      lastName: dbUser?.lastName ?? (payload['lastName'] as string) ?? '',
      role: (dbUser?.role as UserRole) ?? (payload['role'] as UserRole) ?? UserRole.CLIENT_USER,
      aitekRole:
        (dbUser?.aitekRole as AitekRole | null | undefined) ??
        (payload['aitekRole'] as AitekRole) ??
        undefined,
      companyId: membership?.companyId ?? (payload['companyId'] as string) ?? undefined,
      companyMembershipRole:
        (membership?.role as CompanyMembershipRole | undefined) ??
        (payload['companyMembershipRole'] as CompanyMembershipRole) ??
        undefined,
    }

    request.user = user
    return true
  }
}
