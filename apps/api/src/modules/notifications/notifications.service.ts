import { AitekRole, NotificationType, UserRole } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'

import { PrismaService } from '../../prisma/prisma.service'

import { EmailService } from './email.service'

interface NotifyInput {
  type: NotificationType
  title: string
  body: string
  // Entity references (e.g. { projectId }). The frontend builds a role-aware
  // link from these, so we don't store role-specific URLs.
  data?: Record<string, unknown>
}

type EmailPrefField =
  | 'emailOnMessage'
  | 'emailOnMilestone'
  | 'emailOnKYC'
  | 'emailOnInvoice'
  | 'emailOnAgreement'
  | 'emailOnProject'

// Which NotificationPreference flag gates the email for each type. Types not
// listed here get the in-app + realtime notification but NO email — notably
// MESSAGE_RECEIVED, since emailing every chat message would be spam.
const EMAIL_PREF_BY_TYPE: Partial<Record<NotificationType, EmailPrefField>> = {
  [NotificationType.MILESTONE_SUBMITTED]: 'emailOnMilestone',
  [NotificationType.MILESTONE_APPROVED]: 'emailOnMilestone',
  [NotificationType.MILESTONE_REJECTED]: 'emailOnMilestone',
  [NotificationType.PROJECT_CREATED]: 'emailOnProject',
  [NotificationType.KYC_STATUS_CHANGED]: 'emailOnKYC',
  [NotificationType.INVOICE_CREATED]: 'emailOnInvoice',
  [NotificationType.AGREEMENT_SENT]: 'emailOnAgreement',
  [NotificationType.AGREEMENT_ACKNOWLEDGED]: 'emailOnAgreement',
  [NotificationType.DOCUMENT_UPLOADED]: 'emailOnProject',
}

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
    private email: EmailService,
  ) {}

  // Fan out one notification to many users (deduped). No-op for an empty list.
  async notify(userIds: string[], input: NotifyInput): Promise<void> {
    const unique = [...new Set(userIds)].filter(Boolean)
    if (unique.length === 0) return
    await this.prisma.notification.createMany({
      data: unique.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: (input.data ?? {}) as object,
      })),
    })
    // Push a realtime signal so each recipient's bell updates instantly.
    this.events.emit('notification.push', { userIds: unique })
    // Email (fire-and-forget; never blocks or fails the in-app notification).
    void this.sendEmails(unique, input)
  }

  private areaPath(role: UserRole, aitekRole: AitekRole | null): string {
    if (role === UserRole.AITEK_ADMIN) return '/admin'
    if (role === UserRole.AITEK_TEAM_MEMBER) {
      return aitekRole === AitekRole.PROJECT_MANAGER ? '/pm' : '/dev'
    }
    return '/portal'
  }

  // Send an email per recipient whose NotificationPreference allows this type.
  private async sendEmails(userIds: string[], input: NotifyInput): Promise<void> {
    const prefField = EMAIL_PREF_BY_TYPE[input.type]
    if (!prefField) return // type not emailed (e.g. chat messages)

    const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'
    const projectId =
      typeof input.data?.['projectId'] === 'string'
        ? (input.data['projectId'] as string)
        : undefined

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, deletedAt: null },
      select: {
        email: true,
        role: true,
        aitekRole: true,
        notificationPref: {
          select: {
            emailOnMessage: true,
            emailOnMilestone: true,
            emailOnKYC: true,
            emailOnInvoice: true,
            emailOnAgreement: true,
            emailOnProject: true,
          },
        },
      },
    })

    for (const u of users) {
      if (!u.email) continue
      // Default to enabled when the user has no preference row yet.
      const enabled = u.notificationPref ? u.notificationPref[prefField] : true
      if (!enabled) continue
      const area = this.areaPath(u.role as UserRole, (u.aitekRole as AitekRole | null) ?? null)
      const link = projectId ? `${appUrl}${area}/projects/${projectId}` : `${appUrl}${area}`
      void this.email.sendNotificationEmail(u.email, {
        title: input.title,
        body: input.body,
        link,
      })
    }
  }

  async list(user: AuthUser, opts: { cursor?: string; limit?: number }) {
    const take = Math.min(Math.max(opts.limit ?? 20, 1), 50)
    const rows = await this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    })
    const hasMore = rows.length > take
    const notifications = hasMore ? rows.slice(0, take) : rows
    return {
      notifications,
      nextCursor: hasMore ? notifications[notifications.length - 1]?.id : null,
      hasMore,
    }
  }

  async unreadCount(user: AuthUser): Promise<number> {
    return this.prisma.notification.count({ where: { userId: user.id, isRead: false } })
  }

  // Scoped to the owner so users can't mark others' notifications read.
  async markRead(user: AuthUser, id: string): Promise<{ updated: number }> {
    const res = await this.prisma.notification.updateMany({
      where: { id, userId: user.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })
    return { updated: res.count }
  }

  async markAllRead(user: AuthUser): Promise<{ updated: number }> {
    const res = await this.prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })
    return { updated: res.count }
  }
}
