import {
  CompanyMembershipRole,
  NotificationType,
  ProjectMembershipRole,
  UserRole,
} from '@aitek/types'
import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { PrismaService } from '../../prisma/prisma.service'

import { NotificationsService } from './notifications.service'

// Domain-event payloads (emitted by ProjectsService / CompaniesService /
// MessagesService).
interface MilestoneSubmittedEvent {
  projectId: string
  companyId: string
  milestoneName: string
  actorId: string
}
interface MilestoneReviewedEvent {
  projectId: string
  milestoneName: string
  approved: boolean
  actorId: string
}
interface ProjectCreatedEvent {
  projectId: string
  companyId: string
  actorId?: string
}
interface MessageCreatedEvent {
  projectId: string
  isInternal: boolean
  message: { senderId: string; sender: { firstName: string; lastName: string; email: string } | null }
}

@Injectable()
export class NotificationsListener {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // The AiTek side of a project: the assigned lead + members, PLUS all AiTek
  // admins (they oversee every project, so they're always notified).
  private async aitekUserIds(projectId: string): Promise<string[]> {
    const [members, admins] = await Promise.all([
      this.prisma.projectMembership.findMany({
        where: {
          projectId,
          isActive: true,
          role: { in: [ProjectMembershipRole.AITEK_LEAD, ProjectMembershipRole.AITEK_MEMBER] },
        },
        select: { userId: true },
      }),
      this.prisma.user.findMany({
        where: { role: UserRole.AITEK_ADMIN, deletedAt: null },
        select: { id: true },
      }),
    ])
    return [...members.map((r) => r.userId), ...admins.map((a) => a.id)]
  }

  // The client side of a project: stakeholders + the company's client admins.
  private async clientUserIds(projectId: string, companyId: string): Promise<string[]> {
    const [stake, admins] = await Promise.all([
      this.prisma.projectMembership.findMany({
        where: { projectId, isActive: true, role: ProjectMembershipRole.CLIENT_STAKEHOLDER },
        select: { userId: true },
      }),
      this.prisma.companyMembership.findMany({
        where: { companyId, isActive: true, role: CompanyMembershipRole.CLIENT_ADMIN },
        select: { userId: true },
      }),
    ])
    return [...stake.map((r) => r.userId), ...admins.map((r) => r.userId)]
  }

  private without(ids: string[], exclude?: string): string[] {
    return exclude ? ids.filter((id) => id !== exclude) : ids
  }

  @OnEvent('milestone.submitted')
  async onMilestoneSubmitted(e: MilestoneSubmittedEvent) {
    const recipients = await this.clientUserIds(e.projectId, e.companyId)
    await this.notifications.notify(this.without(recipients, e.actorId), {
      type: NotificationType.MILESTONE_SUBMITTED,
      title: 'Milestone awaiting your approval',
      body: `“${e.milestoneName}” is ready for your review.`,
      data: { projectId: e.projectId },
    })
  }

  @OnEvent('milestone.reviewed')
  async onMilestoneReviewed(e: MilestoneReviewedEvent) {
    const recipients = await this.aitekUserIds(e.projectId)
    await this.notifications.notify(this.without(recipients, e.actorId), {
      type: e.approved ? NotificationType.MILESTONE_APPROVED : NotificationType.MILESTONE_REJECTED,
      title: e.approved ? 'Milestone approved' : 'Changes requested on a milestone',
      body: `“${e.milestoneName}” was ${e.approved ? 'approved' : 'sent back for changes'}.`,
      data: { projectId: e.projectId },
    })
  }

  @OnEvent('project.created')
  async onProjectCreated(e: ProjectCreatedEvent) {
    const recipients = await this.clientUserIds(e.projectId, e.companyId)
    await this.notifications.notify(this.without(recipients, e.actorId), {
      type: NotificationType.PROJECT_CREATED,
      title: 'New project',
      body: 'A new project has been created for you.',
      data: { projectId: e.projectId },
    })
  }

  @OnEvent('message.created')
  async onMessage(e: MessageCreatedEvent) {
    const senderId = e.message.senderId
    let recipients: string[]
    if (e.isInternal) {
      recipients = await this.aitekUserIds(e.projectId)
    } else {
      const project = await this.prisma.project.findUnique({
        where: { id: e.projectId },
        select: { companyId: true },
      })
      const aitek = await this.aitekUserIds(e.projectId)
      const client = project ? await this.clientUserIds(e.projectId, project.companyId) : []
      recipients = [...aitek, ...client]
    }
    const name = e.message.sender
      ? `${e.message.sender.firstName} ${e.message.sender.lastName}`.trim() ||
        e.message.sender.email.split('@')[0]
      : 'Someone'
    await this.notifications.notify(this.without(recipients, senderId), {
      type: NotificationType.MESSAGE_RECEIVED,
      title: 'New message',
      body: `${name} sent a message.`,
      data: { projectId: e.projectId },
    })
  }
}
