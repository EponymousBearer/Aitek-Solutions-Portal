import {
  AitekRole,
  CompanyMembershipRole,
  ProjectMembershipRole,
  ProjectStatus,
  UserRole,
} from '@aitek/types'
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

  private assertAitekAdmin(user: AuthUser): void {
    if (user.role !== UserRole.AITEK_ADMIN) {
      throw new ForbiddenException('AiTek admin access required')
    }
  }

  // The set of projects a user is allowed to see, as a Prisma `where`:
  //  - AiTek admin           → every project
  //  - AiTek team (PM / dev)  → only projects they're an active member of
  //  - Client admin           → every project of their company
  //  - Client user            → only projects of their company they're a member of
  private scopeWhere(user: AuthUser): Record<string, unknown> {
    const base = { deletedAt: null }

    if (user.role === UserRole.AITEK_ADMIN) return base

    if (user.role === UserRole.AITEK_TEAM_MEMBER) {
      return { ...base, memberships: { some: { userId: user.id, isActive: true } } }
    }

    const companyId = user.companyId ?? '__none__'
    if (user.companyMembershipRole === CompanyMembershipRole.CLIENT_ADMIN) {
      return { ...base, companyId }
    }

    // CLIENT_USER: scoped to projects they are explicitly a member of.
    return { ...base, companyId, memberships: { some: { userId: user.id, isActive: true } } }
  }

  // Projects visible to this user (see scopeWhere).
  async list(user: AuthUser) {
    return this.prisma.project.findMany({
      where: this.scopeWhere(user),
      orderBy: { createdAt: 'desc' },
      include: {
        company: { select: { id: true, name: true } },
        _count: { select: { milestones: true } },
      },
    })
  }

  // Project + the originating company's full onboarding submission. Access is
  // enforced by folding the visibility scope into the query — a user without
  // access simply gets a 404 (existence is not leaked).
  async getById(id: string, user: AuthUser) {
    const project = await this.prisma.project.findFirst({
      where: { ...this.scopeWhere(user), id },
      include: {
        company: { include: companyOnboardingInclude },
        memberships: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                aitekRole: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!project) throw new NotFoundException('Project not found')
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

    // The company's client admin(s) own the relationship — assign them to the
    // new project as stakeholders by default so it appears in their portal.
    const owners = await this.prisma.companyMembership.findMany({
      where: {
        companyId: input.companyId,
        isActive: true,
        role: CompanyMembershipRole.CLIENT_ADMIN,
      },
      select: { userId: true },
    })

    return this.prisma.project.create({
      data: {
        companyId: input.companyId,
        name: input.name.trim(),
        slug: this.slug(input.name),
        description: input.description?.trim() || null,
        status: ProjectStatus.DISCOVERY,
        createdById: user.id,
        memberships: {
          create: owners.map((o) => ({
            userId: o.userId,
            role: ProjectMembershipRole.CLIENT_STAKEHOLDER,
            addedById: user.id,
          })),
        },
      },
      include: { company: { select: { id: true, name: true } } },
    })
  }

  async update(id: string, input: UpdateProjectInput, user: AuthUser) {
    const existing = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    })
    if (!existing) throw new NotFoundException('Project not found')
    // Admin or the project's lead PM may edit project settings.
    await this.assertCanManageProject(id, user)

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

  // ── Team / membership management ─────────────────────────────

  private readonly memberUserSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    role: true,
    aitekRole: true,
  } as const

  // Admin always; otherwise the active AITEK_LEAD (project manager) of THIS
  // project. Used to gate assigning developers and editing the team.
  private async assertCanManageProject(projectId: string, user: AuthUser): Promise<void> {
    if (user.role === UserRole.AITEK_ADMIN) return

    if (user.role === UserRole.AITEK_TEAM_MEMBER) {
      const membership = await this.prisma.projectMembership.findUnique({
        where: { projectId_userId: { projectId, userId: user.id } },
      })
      if (membership?.isActive && membership.role === ProjectMembershipRole.AITEK_LEAD) return
    }

    throw new ForbiddenException('Only the project manager or an admin can manage this project')
  }

  // The lead + all active members of a project, scoped to viewers who can see it.
  async listMembers(projectId: string, user: AuthUser) {
    const project = await this.prisma.project.findFirst({
      where: { ...this.scopeWhere(user), id: projectId },
      select: { id: true, leadUserId: true },
    })
    if (!project) throw new NotFoundException('Project not found')

    const members = await this.prisma.projectMembership.findMany({
      where: { projectId, isActive: true },
      include: { user: { select: this.memberUserSelect } },
      orderBy: { createdAt: 'asc' },
    })

    return { leadUserId: project.leadUserId, members }
  }

  // Admin assigns a Project Manager as the project's lead. The target must be a
  // PROJECT_MANAGER. Reactivates a previously-removed membership if present.
  async assignLead(projectId: string, userId: string, actor: AuthUser) {
    this.assertAitekAdmin(actor)

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true },
    })
    if (!project) throw new NotFoundException('Project not found')

    const target = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, role: true, aitekRole: true },
    })
    if (!target) throw new NotFoundException('User not found')
    if (target.role !== UserRole.AITEK_TEAM_MEMBER || target.aitekRole !== AitekRole.PROJECT_MANAGER) {
      throw new BadRequestException('Only a Project Manager can be assigned as the project lead')
    }

    await this.prisma.$transaction([
      this.prisma.projectMembership.upsert({
        where: { projectId_userId: { projectId, userId } },
        update: {
          role: ProjectMembershipRole.AITEK_LEAD,
          isActive: true,
          removedAt: null,
          removedById: null,
          addedById: actor.id,
        },
        create: {
          projectId,
          userId,
          role: ProjectMembershipRole.AITEK_LEAD,
          addedById: actor.id,
        },
      }),
      this.prisma.project.update({ where: { id: projectId }, data: { leadUserId: userId } }),
    ])

    return this.listMembers(projectId, actor)
  }

  // Admin unassigns the current project manager (soft-removes the AITEK_LEAD
  // membership and clears leadUserId).
  async removeLead(projectId: string, actor: AuthUser) {
    this.assertAitekAdmin(actor)

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, leadUserId: true },
    })
    if (!project) throw new NotFoundException('Project not found')
    if (!project.leadUserId) throw new BadRequestException('This project has no lead assigned')

    await this.prisma.$transaction([
      this.prisma.projectMembership.updateMany({
        where: { projectId, userId: project.leadUserId, isActive: true },
        data: { isActive: false, removedAt: new Date(), removedById: actor.id },
      }),
      this.prisma.project.update({ where: { id: projectId }, data: { leadUserId: null } }),
    ])

    return this.listMembers(projectId, actor)
  }

  // Add a developer (AITEK_MEMBER) or client stakeholder (CLIENT_STAKEHOLDER) to
  // a project. Admin or the project's lead PM may do this. The AITEK_LEAD role is
  // reserved for assignLead.
  async addMember(
    projectId: string,
    userId: string,
    role: ProjectMembershipRole,
    actor: AuthUser,
  ) {
    await this.assertCanManageProject(projectId, actor)

    if (role === ProjectMembershipRole.AITEK_LEAD) {
      throw new BadRequestException('Use the assign-lead action to set the project manager')
    }

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, companyId: true },
    })
    if (!project) throw new NotFoundException('Project not found')

    const target = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, role: true, aitekRole: true },
    })
    if (!target) throw new NotFoundException('User not found')

    if (role === ProjectMembershipRole.AITEK_MEMBER) {
      if (target.role !== UserRole.AITEK_TEAM_MEMBER || target.aitekRole !== AitekRole.DEVELOPER) {
        throw new BadRequestException('Only a Developer can be added as a project member')
      }
    } else {
      // CLIENT_STAKEHOLDER: must be an active member of this project's company.
      const companyMembership = await this.prisma.companyMembership.findFirst({
        where: { userId, companyId: project.companyId, isActive: true },
        select: { id: true },
      })
      if (!companyMembership) {
        throw new BadRequestException('User is not a member of this project’s client company')
      }
    }

    await this.prisma.projectMembership.upsert({
      where: { projectId_userId: { projectId, userId } },
      update: { role, isActive: true, removedAt: null, removedById: null, addedById: actor.id },
      create: { projectId, userId, role, addedById: actor.id },
    })

    return this.listMembers(projectId, actor)
  }

  // Soft-remove a member. The lead must be unassigned via removeLead instead.
  async removeMember(projectId: string, userId: string, actor: AuthUser) {
    await this.assertCanManageProject(projectId, actor)

    const membership = await this.prisma.projectMembership.findUnique({
      where: { projectId_userId: { projectId, userId } },
    })
    if (!membership || !membership.isActive) {
      throw new NotFoundException('Membership not found')
    }
    if (membership.role === ProjectMembershipRole.AITEK_LEAD) {
      throw new BadRequestException('Use the remove-lead action to unassign the project manager')
    }

    await this.prisma.projectMembership.update({
      where: { projectId_userId: { projectId, userId } },
      data: { isActive: false, removedAt: new Date(), removedById: actor.id },
    })

    return this.listMembers(projectId, actor)
  }
}
