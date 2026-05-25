
import { OnboardingStatus } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

interface AnswerUpsertInput {
  questionId: string
  value: unknown
}

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name)

  constructor(private prisma: PrismaService) {}

  // Idempotent — returns existing session or creates a new one.
  private async ensureSession(user: AuthUser) {
    if (!user.companyId) throw new ForbiddenException('User has no company')

    const existing = await this.prisma.onboardingSession.findFirst({
      where: { companyId: user.companyId, userId: user.id },
    })
    if (existing) return existing

    return this.prisma.onboardingSession.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        status: OnboardingStatus.IN_PROGRESS,
      },
    })
  }

  async getSessionMe(user: AuthUser) {
    if (!user.companyId) return null
    return this.prisma.onboardingSession.findFirst({
      where: { companyId: user.companyId, userId: user.id },
      include: {
        responses: {
          include: {
            answers: {
              include: {
                question: { select: { id: true, text: true, sortOrder: true } },
              },
              orderBy: { question: { sortOrder: 'asc' } },
            },
            template: { select: { id: true, name: true } },
          },
        },
      },
    })
  }

  async setSelectedServices(serviceIds: string[], user: AuthUser) {
    if (!user.companyId) throw new ForbiddenException('User has no company')
    const session = await this.ensureSession(user)

    // Validate that all serviceIds exist
    const count = await this.prisma.service.count({
      where: { id: { in: serviceIds }, isActive: true },
    })
    if (count !== serviceIds.length) {
      throw new BadRequestException('One or more service IDs are invalid')
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.companySelectedService.deleteMany({ where: { companyId: user.companyId! } })
      if (serviceIds.length > 0) {
        await tx.companySelectedService.createMany({
          data: serviceIds.map((serviceId) => ({
            companyId: user.companyId!,
            serviceId,
            sessionId: session.id,
          })),
        })
      }
    })

    return { count: serviceIds.length }
  }

  async getSelectedServices(user: AuthUser) {
    if (!user.companyId) return []
    const rows = await this.prisma.companySelectedService.findMany({
      where: { companyId: user.companyId },
      include: {
        service: {
          select: { id: true, name: true, slug: true, icon: true, categoryId: true },
        },
      },
    })
    return rows.map((r) => r.service)
  }

  async createResponse(templateId: string, user: AuthUser) {
    const session = await this.ensureSession(user)

    const template = await this.prisma.questionnaireTemplate.findUnique({
      where: { id: templateId },
    })
    if (!template) throw new NotFoundException('Questionnaire template not found')

    return this.prisma.questionnaireResponse.upsert({
      where: { sessionId_templateId: { sessionId: session.id, templateId } },
      update: {},
      create: {
        sessionId: session.id,
        templateId,
        templateVersion: template.version,
        status: OnboardingStatus.IN_PROGRESS,
      },
    })
  }

  async upsertAnswers(responseId: string, answers: AnswerUpsertInput[], user: AuthUser) {
    const response = await this.prisma.questionnaireResponse.findUnique({
      where: { id: responseId },
      include: { session: true },
    })
    if (!response) throw new NotFoundException('Response not found')
    if (response.session.userId !== user.id) {
      throw new ForbiddenException('You can only modify your own responses')
    }

    await this.prisma.$transaction(
      answers.map((a) =>
        this.prisma.answer.upsert({
          where: { responseId_questionId: { responseId, questionId: a.questionId } },
          update: { jsonValue: a.value as object },
          create: {
            responseId,
            questionId: a.questionId,
            jsonValue: a.value as object,
          },
        }),
      ),
    )

    return { saved: answers.length }
  }

  async submitResponse(responseId: string, user: AuthUser) {
    const response = await this.prisma.questionnaireResponse.findUnique({
      where: { id: responseId },
      include: { session: true },
    })
    if (!response) throw new NotFoundException('Response not found')
    if (response.session.userId !== user.id) {
      throw new ForbiddenException('You can only submit your own responses')
    }

    await this.prisma.$transaction([
      this.prisma.questionnaireResponse.update({
        where: { id: responseId },
        data: { status: OnboardingStatus.COMPLETED, completedAt: new Date() },
      }),
      this.prisma.onboardingSession.update({
        where: { id: response.sessionId },
        data: { status: OnboardingStatus.COMPLETED, completedAt: new Date() },
      }),
    ])

    // D4 stub: Resend wiring in Prompt 6. For now we log the trigger.
    this.logger.log(
      `[stub] onboarding completed for company=${response.session.companyId} ` +
        `user=${user.id} response=${responseId} — would email AiTek admins`,
    )

    return { completed: true }
  }
}
