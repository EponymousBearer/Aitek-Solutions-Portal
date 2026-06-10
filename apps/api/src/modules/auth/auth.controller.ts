
import { AitekRole, CompanyMembershipRole, UserRole } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
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
import type { Request } from 'express'
import { Webhook } from 'svix'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { ClerkAuthGuard } from '../../common/guards/clerk-auth.guard'

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
    } else if (evt.type === 'user.deleted') {
      const clerkId = (evt.data as { id?: string }).id
      if (clerkId) await this.authService.handleUserDeleted(clerkId)
    }

    return { received: true }
  }

  // Two kinds of invite:
  //  - Company invite: `companyId` (+ optional `role`) → adds the invitee as a
  //    client user/admin of that company.
  //  - AiTek team invite: `aitekRole` (PROJECT_MANAGER | DEVELOPER), no company →
  //    promotes the invitee to an internal team member.
  @Post('invite')
  @UseGuards(ClerkAuthGuard)
  @Roles(UserRole.AITEK_ADMIN)
  async createInvite(
    @Body()
    body: {
      email: string
      companyId?: string
      role?: CompanyMembershipRole
      aitekRole?: AitekRole
    },
  ) {
    const email = body.email?.trim()
    if (!email) throw new BadRequestException('Email is required')

    // AiTek team invite → Clerk invitation: Clerk emails a link; the invitee
    // sets a password on the sign-up page (email pre-verified).
    if (body.aitekRole) {
      try {
        const inv = await this.authService.inviteAitekMember(email, body.aitekRole)
        return { sent: true, email, inviteUrl: inv.url, invitationId: inv.id, status: inv.status }
      } catch (err) {
        // Clerk rejects duplicate invitations / already-registered emails.
        const status = (err as { status?: number })?.status
        const detail =
          (err as { errors?: Array<{ message?: string; longMessage?: string }> })?.errors?.[0]
        const message = detail?.longMessage ?? detail?.message
        if (status === 400 || status === 422) {
          throw new BadRequestException(
            message ?? 'Could not invite this email — it may already be registered or invited.',
          )
        }
        throw err
      }
    }

    // Company (client) invite → JWT link, accepted in-app.
    if (!body.companyId) {
      throw new BadRequestException('companyId is required for a company invite')
    }
    const token = this.authService.createInviteToken(
      email,
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
      aitekRole: payload.aitekRole,
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
