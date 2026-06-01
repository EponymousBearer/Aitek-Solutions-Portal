import { ProjectStatus, UserRole } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

interface CreateProjectInput {
  companyId: string
  name: string
  description?: string | null
}

interface UpdateProjectInput {
  name?: string
  description?: string | null
  status?: ProjectStatus
  startDate?: string | null
  estimatedEndDate?: string | null
  endDate?: string | null
}

// Full onboarding bundle for a company — mirrors CompaniesService.getCompanyDetail
// so a project's detail page can show everything the client submitted.
const companyOnboardingInclude = {
  memberships: {
    where: { isActive: true },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
    },
    orderBy: { joinedAt: 'asc' as const },
  },
  selectedServices: {
    include: { service: { select: { id: true, name: true, slug: true } } },
  },
  customRequests: { orderBy: { createdAt: 'desc' as const }, take: 1 },
  kycSubmissions: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    include: { documents: { orderBy: { createdAt: 'asc' as const } } },
  },
  onboardingSessions: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    include: {
      responses: {
        include: {
          answers: {
            include: { question: { select: { id: true, text: true, sortOrder: true } } },
            orderBy: { question: { sortOrder: 'asc' as const } },
          },
        },
      },
    },
  },
}

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  private isAitekTeam(user: AuthUser): boolean {
    return user.role === UserRole.AITEK_ADMIN || user.role === UserRole.AITEK_TEAM_MEMBER
  }

  private assertAitekTeam(user: AuthUser): void {
    if (!this.isAitekTeam(user)) throw new ForbiddenException('AiTek team access required')
  }

  // Admins see every project (with its company); clients see only their own
  // company's projects.
  async list(user: AuthUser) {
    const where = this.isAitekTeam(user)
      ? { deletedAt: null }
      : { deletedAt: null, companyId: user.companyId ?? '__none__' }

    return this.prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        company: { select: { id: true, name: true } },
        _count: { select: { milestones: true } },
      },
    })
  }

  // Project + the originating company's full onboarding submission. Clients may
  // only read their own company's projects.
  async getById(id: string, user: AuthUser) {
    const project = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: { company: { include: companyOnboardingInclude } },
    })
    if (!project) throw new NotFoundException('Project not found')
    if (!this.isAitekTeam(user) && project.companyId !== user.companyId) {
      throw new ForbiddenException('You do not have access to this project')
    }
    return project
  }

  async create(input: CreateProjectInput, user: AuthUser) {
    this.assertAitekTeam(user)
    if (!input.name?.trim()) throw new BadRequestException('Project name is required')

    const company = await this.prisma.company.findUnique({
      where: { id: input.companyId },
      select: { id: true },
    })
    if (!company) throw new NotFoundException('Company not found')

    return this.prisma.project.create({
      data: {
        companyId: input.companyId,
        name: input.name.trim(),
        slug: this.slug(input.name),
        description: input.description?.trim() || null,
        status: ProjectStatus.DISCOVERY,
        createdById: user.id,
      },
      include: { company: { select: { id: true, name: true } } },
    })
  }

  async update(id: string, input: UpdateProjectInput, user: AuthUser) {
    this.assertAitekTeam(user)
    const existing = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    })
    if (!existing) throw new NotFoundException('Project not found')

    if (input.name !== undefined && !input.name.trim()) {
      throw new BadRequestException('Project name cannot be empty')
    }

    return this.prisma.project.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        description: input.description === undefined ? undefined : input.description?.trim() || null,
        status: input.status,
        startDate: this.toDate(input.startDate),
        estimatedEndDate: this.toDate(input.estimatedEndDate),
        endDate: this.toDate(input.endDate),
      },
      include: { company: { select: { id: true, name: true } } },
    })
  }

  // `undefined` leaves the field unchanged; an empty string clears it.
  private toDate(value: string | null | undefined): Date | null | undefined {
    if (value === undefined) return undefined
    if (value === null || value === '') return null
    return new Date(value)
  }

  private slug(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    const suffix = Math.random().toString(36).slice(2, 7)
    return `${base || 'project'}-${suffix}`
  }
}
