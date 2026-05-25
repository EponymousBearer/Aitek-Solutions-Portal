import { Injectable, NotFoundException } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class QuestionnaireService {
  constructor(private prisma: PrismaService) {}

  async getDefaultTemplate() {
    const template = await this.prisma.questionnaireTemplate.findFirst({
      where: { isDefault: true, isActive: true },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
      },
    })

    if (!template) throw new NotFoundException('No default questionnaire template configured')

    return {
      id: template.id,
      name: template.name,
      slug: template.slug,
      description: template.description,
      version: template.version,
      questions: template.questions.map((q) => ({
        id: q.id,
        text: q.text,
        helpText: q.helpText,
        type: q.type,
        isRequired: q.isRequired,
        section: q.section,
        sortOrder: q.sortOrder,
        options: q.options,
        budgetMin: q.budgetMin,
        budgetMax: q.budgetMax,
        budgetStep: q.budgetStep,
        budgetCurrency: q.budgetCurrency,
        timelineOptions: q.timelineOptions,
      })),
    }
  }
}
