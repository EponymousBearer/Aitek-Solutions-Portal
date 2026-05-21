import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'

import type { AuthUser } from '@aitek/types'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { ClerkAuthGuard } from '../../common/guards/clerk-auth.guard'
import { OnboardingService } from './onboarding.service'

interface SetServicesBody {
  serviceIds: string[]
}

interface CreateResponseBody {
  templateId: string
}

interface UpsertAnswersBody {
  answers: Array<{ questionId: string; value: unknown }>
}

@Controller('onboarding')
@UseGuards(ClerkAuthGuard)
export class OnboardingController {
  constructor(private onboarding: OnboardingService) {}

  @Get('sessions/me')
  async getSessionMe(@CurrentUser() user: AuthUser) {
    return this.onboarding.getSessionMe(user)
  }

  @Get('services')
  async getMySelectedServices(@CurrentUser() user: AuthUser) {
    return this.onboarding.getSelectedServices(user)
  }

  @Post('services')
  async setSelectedServices(@Body() body: SetServicesBody, @CurrentUser() user: AuthUser) {
    return this.onboarding.setSelectedServices(body.serviceIds ?? [], user)
  }

  @Post('responses')
  async createResponse(@Body() body: CreateResponseBody, @CurrentUser() user: AuthUser) {
    return this.onboarding.createResponse(body.templateId, user)
  }

  @Post('responses/:id/answers')
  async upsertAnswers(
    @Param('id') id: string,
    @Body() body: UpsertAnswersBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.onboarding.upsertAnswers(id, body.answers ?? [], user)
  }

  @Post('responses/:id/submit')
  async submitResponse(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.onboarding.submitResponse(id, user)
  }
}
