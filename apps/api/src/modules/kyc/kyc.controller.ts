
import { KYCDocumentCategory, UserRole } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { ClerkAuthGuard } from '../../common/guards/clerk-auth.guard'

import { KycService } from './kyc.service'

const MAX_KYC_BYTES = 15 * 1024 * 1024 // 15MB

interface AddDocumentBody {
  category: KYCDocumentCategory
}

@Controller('kyc')
@UseGuards(ClerkAuthGuard)
export class KycController {
  constructor(private kyc: KycService) {}

  @Get('me')
  async getMine(@CurrentUser() user: AuthUser) {
    return this.kyc.getMine(user)
  }

  @Post('me')
  async createSubmission(@CurrentUser() user: AuthUser) {
    return this.kyc.createSubmission(user)
  }

  // Multipart upload — the file streams through the API to local disk.
  @Post('me/documents')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_KYC_BYTES } }))
  async addDocument(
    @Body() body: AddDocumentBody,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.kyc.addDocument(body.category, file, user)
  }

  // Stream a KYC document, authenticated by the Clerk token (AiTek or the owning
  // client). @Res() bypasses the global response-envelope.
  @Get('documents/:id/download')
  async downloadDocument(
    @Param('id') id: string,
    @Query('disposition') disposition: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const d = disposition === 'attachment' ? 'attachment' : 'inline'
    const { stream, fileName, mimeType, size } = await this.kyc.getDocumentForDownload(id, user)
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

  @Post('me/submit')
  async submitForReview(@CurrentUser() user: AuthUser) {
    return this.kyc.submitForReview(user)
  }

  // ─── Admin review queue ─────────────────────────────────────────────────────

  @Get('submissions')
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async listSubmissions(@CurrentUser() user: AuthUser) {
    return this.kyc.listSubmissionsForReview(user)
  }

  @Post('submissions/:id/approve')
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async approveSubmission(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.kyc.approveSubmission(id, user)
  }

  @Post('submissions/:id/reject')
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async rejectSubmission(
    @Param('id') id: string,
    @Body() body: { notes?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.kyc.requestResubmission(id, user, body?.notes)
  }
}
