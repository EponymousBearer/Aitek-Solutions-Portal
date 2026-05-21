
import { KYCDocumentCategory } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
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
}
