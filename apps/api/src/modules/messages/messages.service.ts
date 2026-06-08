import { UserRole } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'

import { PrismaService } from '../../prisma/prisma.service'
import { ProjectsService } from '../projects/projects.service'

const senderSelect = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
  aitekRole: true,
} as const

type RawMessage = {
  id: string
  projectId: string
  senderId: string
  content: string
  isInternal: boolean
  mentionedUserIds: string[]
  deletedAt: Date | null
  deletedContent: string | null
  createdAt: Date
  sender: {
    id: string
    firstName: string
    lastName: string
    role: string
    aitekRole: string | null
  } | null
}

export interface MessageEvent {
  projectId: string
  isInternal: boolean
  message: ReturnType<MessagesService['present']>
}

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private projects: ProjectsService,
    private events: EventEmitter2,
  ) {}

  private isAitek(user: AuthUser): boolean {
    return user.role === UserRole.AITEK_ADMIN || user.role === UserRole.AITEK_TEAM_MEMBER
  }

  // Client-safe shape: deleted messages show a tombstone instead of content.
  present(m: RawMessage) {
    const deleted = !!m.deletedAt
    return {
      id: m.id,
      projectId: m.projectId,
      senderId: m.senderId,
      content: deleted ? (m.deletedContent ?? '[message deleted]') : m.content,
      isInternal: m.isInternal,
      mentionedUserIds: m.mentionedUserIds,
      deleted,
      createdAt: m.createdAt,
      sender: m.sender,
    }
  }

  // Public gate so the gateway can verify room-join access.
  async assertCanAccess(projectId: string, user: AuthUser) {
    return this.projects.requireProjectAccess(projectId, user)
  }

  // Cursor-paginated history (newest first by cursor, returned oldest→newest for
  // display). Clients never see internal messages.
  async list(projectId: string, user: AuthUser, opts: { cursor?: string; limit?: number }) {
    await this.projects.requireProjectAccess(projectId, user)
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100)

    const rows = await this.prisma.message.findMany({
      where: {
        projectId,
        ...(this.isAitek(user) ? {} : { isInternal: false }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      include: { sender: { select: senderSelect } },
    })

    const hasMore = rows.length > limit
    const page = (hasMore ? rows.slice(0, limit) : rows) as RawMessage[]
    const nextCursor = hasMore ? page[page.length - 1]?.id : null

    return {
      messages: page.map((m) => this.present(m)).reverse(), // oldest → newest
      nextCursor,
      hasMore,
    }
  }

  async create(
    projectId: string,
    user: AuthUser,
    input: { content: string; isInternal?: boolean; mentionedUserIds?: string[] },
  ) {
    await this.projects.requireProjectAccess(projectId, user)

    const content = input.content?.trim()
    if (!content) throw new BadRequestException('Message cannot be empty')
    if (content.length > 5000) throw new BadRequestException('Message is too long')

    const isInternal = !!input.isInternal
    if (isInternal && !this.isAitek(user)) {
      throw new ForbiddenException('Only the AiTek team can post internal messages')
    }

    const created = await this.prisma.message.create({
      data: {
        projectId,
        senderId: user.id,
        content,
        isInternal,
        mentionedUserIds: Array.isArray(input.mentionedUserIds) ? input.mentionedUserIds : [],
      },
      include: { sender: { select: senderSelect } },
    })

    const message = this.present(created as RawMessage)
    this.events.emit('message.created', { projectId, isInternal, message } satisfies MessageEvent)
    return message
  }

  // Soft delete: sender removes own; admin removes any.
  async remove(projectId: string, messageId: string, user: AuthUser) {
    await this.projects.requireProjectAccess(projectId, user)
    const msg = await this.prisma.message.findFirst({ where: { id: messageId, projectId } })
    if (!msg || msg.deletedAt) throw new NotFoundException('Message not found')

    const isOwner = msg.senderId === user.id
    if (!isOwner && user.role !== UserRole.AITEK_ADMIN) {
      throw new ForbiddenException('You can only delete your own messages')
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
      include: { sender: { select: senderSelect } },
    })

    const message = this.present(updated as RawMessage)
    this.events.emit('message.deleted', {
      projectId,
      isInternal: msg.isInternal,
      message,
    } satisfies MessageEvent)
    return message
  }
}
