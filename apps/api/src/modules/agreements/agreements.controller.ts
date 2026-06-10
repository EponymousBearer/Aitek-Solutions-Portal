import { UserRole } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common'
import type { Request } from 'express'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'

import { AgreementsService } from './agreements.service'

interface CreateBody {
  projectId?: string | null
  companyId?: string
  title: string
  description?: string | null
  body: string
  expiresAt?: string | null
}

interface SignBody {
  signerName: string
  signatureImage?: string | null
}

// Behind nginx the real client IP is in X-Forwarded-For (first hop); fall back
// to the socket address for direct connections.
function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.length) return (fwd.split(',')[0] ?? '').trim() || 'unknown'
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

@Controller('agreements')
export class AgreementsController {
  constructor(private agreements: AgreementsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query('projectId') projectId?: string) {
    return this.agreements.list(user, { projectId: projectId || undefined })
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.agreements.getOne(id, user)
  }

  @Post()
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async create(@Body() body: CreateBody, @CurrentUser() user: AuthUser) {
    return this.agreements.create(user, body)
  }

  @Post(':id/sign')
  async sign(
    @Param('id') id: string,
    @Body() body: SignBody,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.agreements.sign(id, user, body, {
      ip: clientIp(req),
      userAgent: (req.headers['user-agent'] as string) || 'unknown',
    })
  }

  @Delete(':id')
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.agreements.remove(id, user)
  }
}
