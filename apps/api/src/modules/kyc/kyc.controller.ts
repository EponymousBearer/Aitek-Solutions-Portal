
import { KYCDocumentCategory, UserRole } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { ClerkAuthGuard } from '../../common/guards/clerk-auth.guard'

import { KycService } from './kyc.service'

interface AddDocumentBody {
  category: KYCDocumentCategory
  fileName: string
  fileSize: number
  mimeType: string
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

  @Post('me/documents')
  async addDocument(@Body() body: AddDocumentBody, @CurrentUser() user: AuthUser) {
    return this.kyc.addDocument(body, user)
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
