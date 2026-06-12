
import { OnboardingPhase, OnboardingStatus } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
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

  // Build the questionnaire dynamically from the client's selected services:
  // each selected service contributes its own question set, and a shared
  // "Project basics" template (budget / timeline / notes) is always appended.
  async getQuestionnaire(user: AuthUser) {
    if (!user.companyId) throw new ForbiddenException('User has no company')

    const selected = await this.prisma.companySelectedService.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: 'asc' },
      select: { serviceId: true },
    })
    const serviceIds = selected.map((s) => s.serviceId)

    const or: Array<{ serviceId?: { in: string[] }; isDefault?: boolean }> = [{ isDefault: true }]
    if (serviceIds.length > 0) or.unshift({ serviceId: { in: serviceIds } })

    const templates = await this.prisma.questionnaireTemplate.findMany({
      where: { isActive: true, OR: or },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
        service: { select: { id: true, name: true } },
      },
    })

    // Service templates follow the client's selection order; the shared default
    // template always sorts last.
    const orderOf = (t: (typeof templates)[number]): number => {
      if (t.isDefault) return Number.MAX_SAFE_INTEGER
      const idx = serviceIds.indexOf(t.serviceId ?? '')
      return idx === -1 ? Number.MAX_SAFE_INTEGER - 1 : idx
    }
    templates.sort((a, b) => orderOf(a) - orderOf(b))

    const questions = templates.flatMap((t) =>
      t.questions.map((q) => ({
        id: q.id,
        templateId: t.id,
        group: t.service?.name ?? 'Project basics',
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
    )

    return { questions }
  }

  // Question-centric save: each answer is routed to the response row for its own
  // template, creating that response on first write. The client never juggles
  // response ids — it just posts { questionId, value } pairs.
  async saveQuestionnaireAnswers(answers: AnswerUpsertInput[], user: AuthUser) {
    if (!user.companyId) throw new ForbiddenException('User has no company')
    const company = await this.loadCompany(user)
    assertPhaseEditable(company, OnboardingPhase.QUESTIONNAIRE)
    const session = await this.ensureSession(user)
    if (answers.length === 0) return { saved: 0 }

    const questions = await this.prisma.question.findMany({
      where: { id: { in: answers.map((a) => a.questionId) } },
      select: { id: true, templateId: true },
    })
    const templateOf = new Map(questions.map((q) => [q.id, q.templateId]))

    // Ensure a response exists per template these answers belong to.
    const responseByTemplate = new Map<string, string>()
    for (const templateId of new Set(questions.map((q) => q.templateId))) {
      const template = await this.prisma.questionnaireTemplate.findUniqueOrThrow({
        where: { id: templateId },
        select: { version: true },
      })
      const response = await this.prisma.questionnaireResponse.upsert({
        where: { sessionId_templateId: { sessionId: session.id, templateId } },
        update: {},
        create: {
          sessionId: session.id,
          templateId,
          templateVersion: template.version,
          status: OnboardingStatus.IN_PROGRESS,
        },
        select: { id: true },
      })
      responseByTemplate.set(templateId, response.id)
    }

    await this.prisma.$transaction(
      answers
        .filter((a) => templateOf.has(a.questionId))
        .map((a) => {
          const responseId = responseByTemplate.get(templateOf.get(a.questionId)!)!
          return this.prisma.answer.upsert({
            where: { responseId_questionId: { responseId, questionId: a.questionId } },
            update: { jsonValue: a.value as object },
            create: { responseId, questionId: a.questionId, jsonValue: a.value as object },
          })
        }),
    )

    return { saved: answers.length }
  }

  // Finish the questionnaire: mark every in-progress response for this session
  // complete and advance the pointer to REVIEW. The onboarding session itself is
  // completed later, at finalize().
  async submitQuestionnaire(user: AuthUser) {
    if (!user.companyId) throw new ForbiddenException('User has no company')
    const company = await this.loadCompany(user)
    assertPhaseEditable(company, OnboardingPhase.QUESTIONNAIRE)
    const session = await this.ensureSession(user)

    await this.prisma.questionnaireResponse.updateMany({
      where: { sessionId: session.id, status: OnboardingStatus.IN_PROGRESS },
      data: { status: OnboardingStatus.COMPLETED, completedAt: new Date() },
    })

    const phase = await advancePhase(this.prisma, user.companyId, OnboardingPhase.QUESTIONNAIRE)
    return { completed: true, phase }
  }
}
