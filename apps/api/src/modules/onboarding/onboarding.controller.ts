import type { AuthUser } from '@aitek/types'
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'


import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { ClerkAuthGuard } from '../../common/guards/clerk-auth.guard'

import { OnboardingService } from './onboarding.service'

interface SetServicesBody {
  serviceIds: string[]
}

interface SaveAnswersBody {
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

  @Get('progress')
  async getProgress(@CurrentUser() user: AuthUser) {
    return this.onboarding.getProgress(user)
  }

  // Submit & lock the company phase, advancing the pointer to KYC.
  @Post('advance')
  async advance(@CurrentUser() user: AuthUser) {
    return this.onboarding.completeCompanyPhase(user)
  }

  // Final, irreversible submit from the REVIEW step.
  @Post('finalize')
  async finalize(@CurrentUser() user: AuthUser) {
    return this.onboarding.finalize(user)
  }

  @Get('services')
  async getMySelectedServices(@CurrentUser() user: AuthUser) {
    return this.onboarding.getSelectedServices(user)
  }

  @Post('services')
  async setSelectedServices(@Body() body: SetServicesBody, @CurrentUser() user: AuthUser) {
    return this.onboarding.setSelectedServices(body.serviceIds ?? [], user)
  }

  // Dynamic questionnaire assembled from the client's selected services.
  @Get('questionnaire')
  async getQuestionnaire(@CurrentUser() user: AuthUser) {
    return this.onboarding.getQuestionnaire(user)
  }

  @Post('questionnaire/answers')
  async saveAnswers(@Body() body: SaveAnswersBody, @CurrentUser() user: AuthUser) {
    return this.onboarding.saveQuestionnaireAnswers(body.answers ?? [], user)
  }

  @Post('questionnaire/submit')
  async submitQuestionnaire(@CurrentUser() user: AuthUser) {
    return this.onboarding.submitQuestionnaire(user)
  }
}
