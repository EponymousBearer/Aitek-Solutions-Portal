import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { verifyToken } from '@clerk/backend'

import type { AuthUser } from '@aitek/types'
import { UserRole, CompanyMembershipRole } from '@aitek/types'

import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

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

    try {
      const payload = await verifyToken(token, {
        secretKey: process.env['CLERK_SECRET_KEY'] ?? '',
      })

      const user: AuthUser = {
        id: payload.sub,
        clerkId: payload.sub,
        email: (payload['email'] as string) ?? '',
        firstName: (payload['firstName'] as string) ?? '',
        lastName: (payload['lastName'] as string) ?? '',
        role: (payload['role'] as UserRole) ?? UserRole.CLIENT_USER,
        companyId: (payload['companyId'] as string) ?? undefined,
        companyMembershipRole:
          (payload['companyMembershipRole'] as CompanyMembershipRole) ?? undefined,
      }

      request.user = user
      return true
    } catch {
      throw new UnauthorizedException('Invalid or expired token')
    }
  }
}
