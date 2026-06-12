import { QuestionType, UserRole } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

// Types the client questionnaire fully renders today. The admin builder is
// limited to these so it can't create questions the onboarding chat shows as a
// fallback text box (FILE_UPLOAD / RATING_SCALE / VOICE_NOTE are out for now).
const EDITABLE_TYPES: QuestionType[] = [
  QuestionType.TEXT,
  QuestionType.LONG_TEXT,
  QuestionType.MULTIPLE_CHOICE,
  QuestionType.CHECKBOX,
  QuestionType.BUDGET_SLIDER,
  QuestionType.TIMELINE_SELECTOR,
  QuestionType.TEAM_SIZE,
  QuestionType.URL_INPUT,
]

interface QuestionWriteInput {
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

  // ─── Admin questionnaire builder ────────────────────────────────────────────

  private assertAitekTeam(user: AuthUser): void {
    if (user.role !== UserRole.AITEK_ADMIN && user.role !== UserRole.AITEK_TEAM_MEMBER) {
      throw new ForbiddenException('AiTek team access required')
    }
  }

  // Every active template grouped by the service it belongs to (the shared
  // "Project basics" template — no service — lands in a "General" group last).
  async listForAdmin(user: AuthUser) {
    this.assertAitekTeam(user)

    const templates = await this.prisma.questionnaireTemplate.findMany({
      where: { isActive: true },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
        service: {
          select: {
            id: true,
            name: true,
            sortOrder: true,
            category: { select: { id: true, name: true, sortOrder: true } },
          },
        },
      },
    })

    const groups = templates.map((t) => ({
      templateId: t.id,
      templateName: t.name,
      isDefault: t.isDefault,
      serviceId: t.service?.id ?? null,
      serviceName: t.service?.name ?? 'General (all clients)',
      categoryName: t.service?.category?.name ?? null,
      categorySort: t.service?.category?.sortOrder ?? Number.MAX_SAFE_INTEGER,
      serviceSort: t.service?.sortOrder ?? 0,
      questions: t.questions.map((q) => ({
        id: q.id,
        text: q.text,
        helpText: q.helpText,
        type: q.type,
        isRequired: q.isRequired,
        sortOrder: q.sortOrder,
        options: q.options,
        budgetMin: q.budgetMin,
        budgetMax: q.budgetMax,
        budgetStep: q.budgetStep,
        budgetCurrency: q.budgetCurrency,
        timelineOptions: q.timelineOptions,
      })),
    }))

    // Service templates by category → service order; the shared default last.
    groups.sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? 1 : -1
      if (a.categorySort !== b.categorySort) return a.categorySort - b.categorySort
      return a.serviceSort - b.serviceSort
    })

    return groups
  }

  async createQuestion(templateId: string, input: QuestionWriteInput, user: AuthUser) {
    this.assertAitekTeam(user)
    const template = await this.prisma.questionnaireTemplate.findUnique({
      where: { id: templateId },
      select: { id: true },
    })
    if (!template) throw new NotFoundException('Template not found')

    const last = await this.prisma.question.findFirst({
      where: { templateId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })

    return this.prisma.question.create({
      data: {
        templateId,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        ...this.normalize(input),
      },
    })
  }

  async updateQuestion(id: string, input: QuestionWriteInput, user: AuthUser) {
    this.assertAitekTeam(user)
    const existing = await this.prisma.question.findUnique({ where: { id }, select: { id: true } })
    if (!existing) throw new NotFoundException('Question not found')

    return this.prisma.question.update({
      where: { id },
      data: this.normalize(input),
    })
  }

  // Removing a question also removes any answers clients gave to it.
  async deleteQuestion(id: string, user: AuthUser) {
    this.assertAitekTeam(user)
    const existing = await this.prisma.question.findUnique({ where: { id }, select: { id: true } })
    if (!existing) throw new NotFoundException('Question not found')

    await this.prisma.$transaction([
      this.prisma.answer.deleteMany({ where: { questionId: id } }),
      this.prisma.question.delete({ where: { id } }),
    ])
    return { deleted: true }
  }

  async reorderQuestions(templateId: string, orderedIds: string[], user: AuthUser) {
    this.assertAitekTeam(user)
    const questions = await this.prisma.question.findMany({
      where: { templateId },
      select: { id: true },
    })
    const owned = new Set(questions.map((q) => q.id))
    if (orderedIds.length !== owned.size || !orderedIds.every((qid) => owned.has(qid))) {
      throw new BadRequestException('Reorder list must contain exactly this template’s questions')
    }

    await this.prisma.$transaction(
      orderedIds.map((qid, i) =>
        this.prisma.question.update({ where: { id: qid }, data: { sortOrder: i } }),
      ),
    )
    return { reordered: orderedIds.length }
  }

  // Validate + coerce a write payload: enforce the supported type set and strip
  // config that doesn't apply to the chosen type.
  private normalize(input: QuestionWriteInput) {
    if (!input.text?.trim()) throw new BadRequestException('Question text is required')
    if (!EDITABLE_TYPES.includes(input.type)) {
      throw new BadRequestException(`Unsupported question type: ${input.type}`)
    }

    const isChoice = input.type === QuestionType.MULTIPLE_CHOICE || input.type === QuestionType.CHECKBOX
    const isBudget = input.type === QuestionType.BUDGET_SLIDER
    const isTimeline = input.type === QuestionType.TIMELINE_SELECTOR

    const options = (input.options ?? []).map((o) => o.trim()).filter(Boolean)
    if (isChoice && options.length === 0) {
      throw new BadRequestException('Choice questions need at least one option')
    }
    const timelineOptions = (input.timelineOptions ?? []).map((o) => o.trim()).filter(Boolean)
    if (isTimeline && timelineOptions.length === 0) {
      throw new BadRequestException('Timeline questions need at least one option')
    }

    return {
      text: input.text.trim(),
      helpText: input.helpText?.trim() || null,
      type: input.type,
      isRequired: input.isRequired ?? true,
      options: isChoice ? options : undefined,
      timelineOptions: isTimeline ? timelineOptions : undefined,
      budgetMin: isBudget ? (input.budgetMin ?? 0) : null,
      budgetMax: isBudget ? (input.budgetMax ?? 100000) : null,
      budgetStep: isBudget ? (input.budgetStep ?? 1000) : null,
      budgetCurrency: isBudget ? (input.budgetCurrency?.trim() || 'USD') : null,
    }
  }
}
