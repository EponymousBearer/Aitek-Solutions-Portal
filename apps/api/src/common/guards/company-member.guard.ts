import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'

import { UserRole } from '@aitek/types'

@Injectable()
export class CompanyMemberGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const user = request.user
    const companyId = request.params?.companyId

    if (!companyId) return true

    // AiTek admins can access any company
    if (user?.role === UserRole.AITEK_ADMIN || user?.role === UserRole.AITEK_TEAM_MEMBER) {
      return true
    }

    if (user?.companyId !== companyId) {
      throw new ForbiddenException('Access denied to this company')
    }

    return true
  }
}
