
import { OnboardingPhase, OnboardingStatus } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

import { advancePhase, assertPhaseEditable, computeProgress } from './onboarding-phase'

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

  private async loadCompany(user: AuthUser) {
    if (!user.companyId) throw new ForbiddenException('User has no company')
    return this.prisma.company.findUniqueOrThrow({
      where: { id: user.companyId },
      select: { onboardingPhase: true, name: true },
    })
  }

  // Current onboarding progress (phase pointer → checklist + overall %).
  async getProgress(user: AuthUser) {
    if (!user.companyId) {
      return computeProgress({ onboardingPhase: OnboardingPhase.COMPANY })
    }
    const company = await this.loadCompany(user)
    return computeProgress(company)
  }

  // "Submit & lock" the company phase, advancing the pointer to KYC.
  async completeCompanyPhase(user: AuthUser) {
    const company = await this.loadCompany(user)
    assertPhaseEditable(company, OnboardingPhase.COMPANY)
    if (!company.name?.trim()) {
      throw new BadRequestException('Company name is required before continuing')
    }
    const phase = await advancePhase(this.prisma, user.companyId!, OnboardingPhase.COMPANY)
    return { phase }
  }

  // Final, irreversible submit from the REVIEW step: mark the session complete,
  // lock everything (phase → SUBMITTED), stamp the review time, notify admins.
  async finalize(user: AuthUser) {
    const company = await this.loadCompany(user)
    if (company.onboardingPhase !== OnboardingPhase.REVIEW) {
      throw new ConflictException('Onboarding is not ready to submit for review')
    }
    const session = await this.ensureSession(user)

    await this.prisma.$transaction([
      this.prisma.onboardingSession.update({
        where: { id: session.id },
        data: { status: OnboardingStatus.COMPLETED, completedAt: new Date() },
      }),
      this.prisma.company.update({
        where: { id: user.companyId! },
        data: { onboardingPhase: OnboardingPhase.SUBMITTED, submittedForReviewAt: new Date() },
      }),
    ])

    // D4 stub: Resend wiring in Prompt 6. For now we log the trigger.
    this.logger.log(
      `[stub] onboarding finalized for company=${user.companyId} user=${user.id} ` +
        `— would email AiTek admins`,
    )

    return { submitted: true }
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
    const company = await this.loadCompany(user)
    assertPhaseEditable(company, OnboardingPhase.SERVICES)
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

    const phase = await advancePhase(this.prisma, user.companyId, OnboardingPhase.SERVICES)
    return { count: serviceIds.length, phase }
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
    const company = await this.loadCompany(user)
    assertPhaseEditable(company, OnboardingPhase.QUESTIONNAIRE)
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
    const company = await this.loadCompany(user)
    assertPhaseEditable(company, OnboardingPhase.QUESTIONNAIRE)

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
    const company = await this.loadCompany(user)
    assertPhaseEditable(company, OnboardingPhase.QUESTIONNAIRE)

    // Complete the response only. The onboarding session is NOT completed here —
    // that now happens at finalize(), after the client confirms the REVIEW step.
    await this.prisma.questionnaireResponse.update({
      where: { id: responseId },
      data: { status: OnboardingStatus.COMPLETED, completedAt: new Date() },
    })

    const phase = await advancePhase(this.prisma, user.companyId!, OnboardingPhase.QUESTIONNAIRE)
    return { completed: true, phase }
  }
}
