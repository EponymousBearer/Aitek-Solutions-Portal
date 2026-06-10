import { UserRole } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Request, Response } from 'express'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'

import { AgreementsService } from './agreements.service'

const MAX_DOC_BYTES = 20 * 1024 * 1024 // 20MB

interface CreateBody {
  projectId?: string | null
  companyId?: string
  title: string
  description?: string | null
  body?: string | null
  expiresAt?: string | null
}

interface SignBody {
  signerName: string
  signatureImage?: string | null
}

interface DeclineBody {
  reason?: string | null
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

  // Multipart so an optional PDF rides alongside the text fields.
  @Post()
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_DOC_BYTES } }))
  async create(
    @Body() body: CreateBody,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.agreements.create(user, body, file)
  }

  // Stream the attached PDF, authenticated by the Clerk token. Inline so the
  // browser previews it; @Res() bypasses the global response-envelope.
  @Get(':id/document')
  async document(
    @Param('id') id: string,
    @Query('disposition') disposition: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const d = disposition === 'attachment' ? 'attachment' : 'inline'
    const { stream, fileName, mimeType, size } = await this.agreements.getDocumentForDownload(
      id,
      user,
    )
    const safeName = fileName.replace(/["\r\n]/g, '')
    res.set({
      'Content-Type': mimeType,
      'Content-Length': String(size),
      'Content-Disposition': `${d}; filename="${safeName}"`,
    })
    stream.on('error', () => {
      if (!res.headersSent) res.status(404).end()
      else res.end()
    })
    stream.pipe(res)
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

  @Post(':id/decline')
  async decline(
    @Param('id') id: string,
    @Body() body: DeclineBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.agreements.decline(id, user, body)
  }

  // AiTek revokes a pending agreement (marks it EXPIRED).
  @Post(':id/expire')
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async expire(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.agreements.expire(id, user)
  }

  @Delete(':id')
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.agreements.remove(id, user)
  }
}
