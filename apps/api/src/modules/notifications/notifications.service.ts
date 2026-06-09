import { NotificationType } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

interface NotifyInput {
  type: NotificationType
  title: string
  body: string
  // Entity references (e.g. { projectId }). The frontend builds a role-aware
  // link from these, so we don't store role-specific URLs.
  data?: Record<string, unknown>
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

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
