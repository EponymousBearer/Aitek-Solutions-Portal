import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common'
import { Webhook } from 'svix'
import type { Request } from 'express'

import { CompanyMembershipRole, UserRole } from '@aitek/types'
import type { AuthUser } from '@aitek/types'

import { ClerkAuthGuard } from '../../common/guards/clerk-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { AuthService } from './auth.service'

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('me')
  @UseGuards(ClerkAuthGuard)
  async getMe(@CurrentUser() user: AuthUser) {
    return this.authService.getUserContext(user.clerkId)
  }

  @Post('webhook/clerk')
  @Public()
  async handleClerkWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
  ) {
    const webhookSecret = process.env['CLERK_WEBHOOK_SECRET']
    if (!webhookSecret) throw new BadRequestException('Webhook secret not configured')

    const rawBody = req.rawBody
    if (!rawBody) throw new BadRequestException('Missing raw body')

    const wh = new Webhook(webhookSecret)
    let evt: { type: string; data: Record<string, unknown> }

    try {
      evt = wh.verify(rawBody, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as typeof evt
    } catch {
      throw new BadRequestException('Invalid webhook signature')
    }

    if (evt.type === 'user.created') {
      await this.authService.handleUserCreated(
        evt.data as Parameters<AuthService['handleUserCreated']>[0],
      )
    }

    return { received: true }
  }

  @Post('invite')
  @UseGuards(ClerkAuthGuard)
  @Roles(UserRole.AITEK_ADMIN)
  async createInvite(
    @Body() body: { email: string; companyId?: string; role?: CompanyMembershipRole },
  ) {
    const token = this.authService.createInviteToken(
      body.email,
      body.role ?? CompanyMembershipRole.CLIENT_USER,
      body.companyId,
    )
    return { token, inviteUrl: `${process.env['NEXT_PUBLIC_APP_URL']}/invite/${token}` }
  }

  @Get('invite/:token')
  @Public()
  async validateInvite(@Param('token') token: string) {
    const payload = this.authService.validateInviteToken(token)
    return {
      email: payload.email,
      companyId: payload.companyId,
      role: payload.membershipRole,
      type: payload.type,
    }
  }

  @Post('invite/:token/accept')
  @UseGuards(ClerkAuthGuard)
  async acceptInvite(@Param('token') token: string, @CurrentUser() user: AuthUser) {
    await this.authService.acceptInvite(token, user)
    return { accepted: true }
  }
}
