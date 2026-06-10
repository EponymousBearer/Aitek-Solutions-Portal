import { DeliverableStatus } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'

import { PrismaService } from '../../prisma/prisma.service'
import { ProjectsService } from '../projects/projects.service'

interface CreateInput {
  title: string
  description?: string | null
  url?: string | null
  status?: DeliverableStatus
}

interface UpdateInput {
  title?: string
  description?: string | null
  url?: string | null
  status?: DeliverableStatus
}

@Injectable()
export class DeliverablesService {
  constructor(
    private prisma: PrismaService,
    private projects: ProjectsService,
    private events: EventEmitter2,
  ) {}

  // Tell the client side a deliverable is ready (in-app + realtime + email).
  private emitDelivered(projectId: string, companyId: string, title: string, actorId: string) {
    this.events.emit('deliverable.delivered', { projectId, companyId, title, actorId })
  }

  // Everyone who can see the project sees its deliverables. `canManage` tells the
  // UI whether to show add/edit controls (admin or the lead PM).
  async list(projectId: string, user: AuthUser) {
    await this.projects.requireProjectAccess(projectId, user)
    const [deliverables, canManage] = await Promise.all([
      this.prisma.deliverable.findMany({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
      }),
      this.projects.canManageProject(projectId, user),
    ])
    return { deliverables, canManage }
  }

  private normalizeUrl(url?: string | null): string | null {
    const u = url?.trim()
    if (!u) return null
    if (!/^https?:\/\//i.test(u)) throw new BadRequestException('Link must start with http:// or https://')
    return u
  }

  async create(projectId: string, input: CreateInput, user: AuthUser) {
    const project = await this.projects.requireProjectAccess(projectId, user)
    await this.projects.requireProjectManage(projectId, user)

    const title = input.title?.trim()
    if (!title) throw new BadRequestException('A title is required')

    const status = input.status === DeliverableStatus.DELIVERED ? DeliverableStatus.DELIVERED : DeliverableStatus.PENDING
    const deliverable = await this.prisma.deliverable.create({
      data: {
        projectId,
        title,
        description: input.description?.trim() || null,
        url: this.normalizeUrl(input.url),
        status,
        deliveredAt: status === DeliverableStatus.DELIVERED ? new Date() : null,
        createdById: user.id,
      },
    })
    if (status === DeliverableStatus.DELIVERED) {
      this.emitDelivered(projectId, project.companyId, title, user.id)
    }
    return deliverable
  }

  async update(projectId: string, id: string, input: UpdateInput, user: AuthUser) {
    const project = await this.projects.requireProjectAccess(projectId, user)
    await this.projects.requireProjectManage(projectId, user)

    const existing = await this.prisma.deliverable.findFirst({ where: { id, projectId } })
    if (!existing) throw new NotFoundException('Deliverable not found')

    const data: Record<string, unknown> = {}
    if (typeof input.title === 'string') {
      const t = input.title.trim()
      if (!t) throw new BadRequestException('A title is required')
      data['title'] = t
    }
    if (input.description !== undefined) data['description'] = input.description?.trim() || null
    if (input.url !== undefined) data['url'] = this.normalizeUrl(input.url)
    let justDelivered = false
    if (input.status && input.status !== existing.status) {
      data['status'] = input.status
      data['deliveredAt'] = input.status === DeliverableStatus.DELIVERED ? new Date() : null
      justDelivered = input.status === DeliverableStatus.DELIVERED
    }

    const updated = await this.prisma.deliverable.update({ where: { id }, data })
    if (justDelivered) {
      this.emitDelivered(projectId, project.companyId, updated.title, user.id)
    }
    return updated
  }

  async remove(projectId: string, id: string, user: AuthUser) {
    await this.projects.requireProjectAccess(projectId, user)
    await this.projects.requireProjectManage(projectId, user)

    const existing = await this.prisma.deliverable.findFirst({ where: { id, projectId } })
    if (!existing) throw new NotFoundException('Deliverable not found')

    await this.prisma.deliverable.delete({ where: { id } })
    return { deleted: true }
  }
}
