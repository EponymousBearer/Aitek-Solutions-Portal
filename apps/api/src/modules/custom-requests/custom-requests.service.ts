import {
  CompanyMembershipRole,
  CustomRequestStatus,
  NotificationType,
  OnboardingPhase,
  UserRole,
} from '@aitek/types'
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
import { advancePhase } from '../onboarding/onboarding-phase'

interface CustomRequestInput {
  description: string
  goals?: string
  budget?: string
  timeline?: string
  fileKeys?: string[]
}

// The "Something else" / custom request flow (PRD §6). A client who picks
// "none of these fit" describes what they need in free form; it stands in for
// service selection + the questionnaire and lands in an admin review queue.
@Injectable()
export class CustomRequestsService {
  private readonly logger = new Logger(CustomRequestsService.name)

  constructor(private prisma: PrismaService) {}

  private assertAitekTeam(user: AuthUser): void {
    if (user.role !== UserRole.AITEK_ADMIN && user.role !== UserRole.AITEK_TEAM_MEMBER) {
      throw new ForbiddenException('AiTek team access required')
    }
  }

  async getMine(user: AuthUser) {
    if (!user.companyId) return null
    return this.prisma.customRequest.findFirst({
      where: { companyId: user.companyId },
      orderBy: { createdAt: 'desc' },
    })
  }

  // Client submits (or updates, during review) their custom request. Because it
  // replaces both the services and questionnaire phases, this advances the
  // onboarding pointer straight to REVIEW.
  async submit(input: CustomRequestInput, user: AuthUser) {
    if (!user.companyId) throw new ForbiddenException('User has no company')
    if (!input.description?.trim()) {
      throw new BadRequestException('Please describe what you are looking for')
    }

    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: user.companyId },
      select: { onboardingPhase: true, name: true },
    })
    const editable =
      company.onboardingPhase === OnboardingPhase.SERVICES ||
      company.onboardingPhase === OnboardingPhase.QUESTIONNAIRE ||
      company.onboardingPhase === OnboardingPhase.REVIEW
    if (!editable) {
      throw new ConflictException(
        'This onboarding section is locked and can no longer be edited.',
      )
    }

    const data = {
      description: input.description.trim(),
      goals: input.goals?.trim() || null,
      budget: input.budget?.trim() || null,
      timeline: input.timeline?.trim() || null,
      fileKeys: input.fileKeys ?? [],
    }

    // One active custom request per company — update the latest, or create.
    const existing = await this.prisma.customRequest.findFirst({
      where: { companyId: user.companyId },
      orderBy: { createdAt: 'desc' },
    })
    const request = existing
      ? await this.prisma.customRequest.update({
          where: { id: existing.id },
          data: { ...data, status: CustomRequestStatus.PENDING_REVIEW },
        })
      : await this.prisma.customRequest.create({
          data: { companyId: user.companyId, userId: user.id, ...data },
        })

    await this.notifyAdmins(company.name, user.companyId, request.id)

    const phase = await advancePhase(this.prisma, user.companyId, OnboardingPhase.QUESTIONNAIRE)
    return { id: request.id, phase }
  }

  private async notifyAdmins(companyName: string, companyId: string, customRequestId: string) {
    const admins = await this.prisma.user.findMany({
      where: { role: { in: [UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER] } },
      select: { id: true },
    })
    if (admins.length === 0) return
    await this.prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: NotificationType.CUSTOM_REQUEST_RECEIVED,
        title: 'New custom project request',
        body: `${companyName} submitted a "Something else" request for review.`,
        data: { companyId, customRequestId },
      })),
    })
    this.logger.log(`Custom request ${customRequestId} — notified ${admins.length} admin(s)`)
  }

  // ─── Admin review queue ─────────────────────────────────────────────────────

  async listForReview(user: AuthUser) {
    this.assertAitekTeam(user)
    return this.prisma.customRequest.findMany({
      where: { status: CustomRequestStatus.PENDING_REVIEW },
      orderBy: { createdAt: 'desc' },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            memberships: {
              where: { isActive: true, role: CompanyMembershipRole.CLIENT_ADMIN },
              take: 1,
              include: { user: { select: { email: true, firstName: true, lastName: true } } },
            },
          },
        },
      },
    })
  }

  async approve(id: string, user: AuthUser) {
    this.assertAitekTeam(user)
    await this.setStatus(id, CustomRequestStatus.APPROVED)
    return { status: CustomRequestStatus.APPROVED }
  }

  async reject(id: string, user: AuthUser) {
    this.assertAitekTeam(user)
    await this.setStatus(id, CustomRequestStatus.REJECTED)
    return { status: CustomRequestStatus.REJECTED }
  }

  private async setStatus(id: string, status: CustomRequestStatus) {
    const existing = await this.prisma.customRequest.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!existing) throw new NotFoundException('Custom request not found')
    await this.prisma.customRequest.update({ where: { id }, data: { status } })
  }
}
