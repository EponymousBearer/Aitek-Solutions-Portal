import { QuestionType, UserRole } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { ClerkAuthGuard } from '../../common/guards/clerk-auth.guard'

import { QuestionnaireService } from './questionnaire.service'

interface QuestionBody {
  text: string
  helpText?: string | null
  type: QuestionType
  isRequired?: boolean
  options?: string[] | null
  budgetMin?: number | null
  budgetMax?: number | null
  budgetStep?: number | null
  budgetCurrency?: string | null
  timelineOptions?: string[] | null
}

@Controller('questionnaire')
@UseGuards(ClerkAuthGuard)
export class QuestionnaireController {
  constructor(private questionnaireService: QuestionnaireService) {}

  @Get('templates/default')
  async getDefaultTemplate() {
    return this.questionnaireService.getDefaultTemplate()
  }

  // ─── Admin builder ──────────────────────────────────────────────────────────

  @Get('admin/templates')
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async listForAdmin(@CurrentUser() user: AuthUser) {
    return this.questionnaireService.listForAdmin(user)
  }

  @Post('admin/templates/:templateId/questions')
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async createQuestion(
    @Param('templateId') templateId: string,
    @Body() body: QuestionBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.questionnaireService.createQuestion(templateId, body, user)
  }

  @Patch('admin/questions/:id')
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async updateQuestion(
    @Param('id') id: string,
    @Body() body: QuestionBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.questionnaireService.updateQuestion(id, body, user)
  }

  @Delete('admin/questions/:id')
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async deleteQuestion(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.questionnaireService.deleteQuestion(id, user)
  }

  @Post('admin/templates/:templateId/reorder')
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async reorder(
    @Param('templateId') templateId: string,
    @Body() body: { orderedIds: string[] },
    @CurrentUser() user: AuthUser,
  ) {
    return this.questionnaireService.reorderQuestions(templateId, body.orderedIds ?? [], user)
  }
}
