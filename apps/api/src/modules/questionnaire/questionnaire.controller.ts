import { Controller, Get, UseGuards } from '@nestjs/common'

import { ClerkAuthGuard } from '../../common/guards/clerk-auth.guard'

import { QuestionnaireService } from './questionnaire.service'

@Controller('questionnaire')
@UseGuards(ClerkAuthGuard)
export class QuestionnaireController {
  constructor(private questionnaireService: QuestionnaireService) {}

  @Get('templates/default')
  async getDefaultTemplate() {
    return this.questionnaireService.getDefaultTemplate()
  }
}
