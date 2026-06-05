import { UserRole } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { ClerkAuthGuard } from '../../common/guards/clerk-auth.guard'

import { CustomRequestsService } from './custom-requests.service'

interface SubmitBody {
  description: string
  goals?: string
  budget?: string
  timeline?: string
  fileKeys?: string[]
}

@Controller('custom-requests')
@UseGuards(ClerkAuthGuard)
export class CustomRequestsController {
  constructor(private customRequests: CustomRequestsService) {}

  @Post()
  async submit(@Body() body: SubmitBody, @CurrentUser() user: AuthUser) {
    return this.customRequests.submit(body, user)
  }

  @Get('me')
  async getMine(@CurrentUser() user: AuthUser) {
    return this.customRequests.getMine(user)
  }

  // ─── Admin ──────────────────────────────────────────────────────────────────

  @Get()
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async list(@CurrentUser() user: AuthUser) {
    return this.customRequests.listForReview(user)
  }

  @Post(':id/approve')
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.customRequests.approve(id, user)
  }

  @Post(':id/reject')
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async reject(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.customRequests.reject(id, user)
  }
}
