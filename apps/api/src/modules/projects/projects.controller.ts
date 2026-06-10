import { ProjectMembershipRole, ProjectStatus, UserRole } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { ClerkAuthGuard } from '../../common/guards/clerk-auth.guard'

import { ProjectsService } from './projects.service'

interface CreateProjectBody {
  companyId: string
  name: string
  description?: string | null
}

interface UpdateProjectBody {
  name?: string
  description?: string | null
  status?: ProjectStatus
  startDate?: string | null
  estimatedEndDate?: string | null
  endDate?: string | null
}

interface AssignLeadBody {
  userId: string
}

interface AddMemberBody {
  userId: string
  role: ProjectMembershipRole
}

interface MilestoneBody {
  name?: string
  description?: string | null
  dueDate?: string | null
  sortOrder?: number
}

@Controller('projects')
@UseGuards(ClerkAuthGuard)
export class ProjectsController {
  constructor(private projects: ProjectsService) {}

  // Both roles: admins get all projects, clients get their company's.
  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return this.projects.list(user)
  }

  @Get(':id')
  async getById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projects.getById(id, user)
  }

  @Post()
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async create(@Body() body: CreateProjectBody, @CurrentUser() user: AuthUser) {
    return this.projects.create(body, user)
  }

  @Patch(':id')
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async update(
    @Param('id') id: string,
    @Body() body: UpdateProjectBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projects.update(id, body, user)
  }

  // ── Team / membership ──────────────────────────────
  // Visibility is enforced in the service (scoped to projects the user can see).

  @Get(':id/members')
  async listMembers(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projects.listMembers(id, user)
  }

  // Admin assigns / unassigns the Project Manager (lead).
  @Post(':id/lead')
  @Roles(UserRole.AITEK_ADMIN)
  async assignLead(
    @Param('id') id: string,
    @Body() body: AssignLeadBody,
    @CurrentUser() user: AuthUser,
  ) {
    if (!body?.userId) throw new BadRequestException('userId is required')
    return this.projects.assignLead(id, body.userId, user)
  }

  @Delete(':id/lead')
  @Roles(UserRole.AITEK_ADMIN)
  async removeLead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projects.removeLead(id, user)
  }

  // Admin or the project's lead PM adds / removes developers and client stakeholders.
  @Post(':id/members')
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async addMember(
    @Param('id') id: string,
    @Body() body: AddMemberBody,
    @CurrentUser() user: AuthUser,
  ) {
    if (!body?.userId) throw new BadRequestException('userId is required')
    if (!body?.role || !Object.values(ProjectMembershipRole).includes(body.role)) {
      throw new BadRequestException('A valid membership role is required')
    }
    return this.projects.addMember(id, body.userId, body.role, user)
  }

  @Delete(':id/members/:userId')
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projects.removeMember(id, userId, user)
  }

  // ── Milestones ─────────────────────────────────────
  // View: any viewer who can see the project (scoped in the service).
  // Create/edit/delete/submit: AiTek team. Approve/reject: client or admin
  // (the service blocks AiTek team members from approving).

  @Get(':id/milestones')
  async listMilestones(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projects.listMilestones(id, user)
  }

  @Post(':id/milestones')
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async createMilestone(
    @Param('id') id: string,
    @Body() body: MilestoneBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projects.createMilestone(id, body, user)
  }

  @Patch(':id/milestones/:milestoneId')
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async updateMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @Body() body: MilestoneBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projects.updateMilestone(id, milestoneId, body, user)
  }

  @Delete(':id/milestones/:milestoneId')
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async deleteMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projects.deleteMilestone(id, milestoneId, user)
  }

  @Post(':id/milestones/:milestoneId/submit')
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async submitMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @Body() body: { completionNote?: string | null },
    @CurrentUser() user: AuthUser,
  ) {
    return this.projects.submitMilestone(id, milestoneId, body ?? {}, user)
  }

  // No @Roles guard — the service permits clients + admin and blocks team members.
  @Post(':id/milestones/:milestoneId/approve')
  async approveMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @Body() body: { reviewComment?: string | null },
    @CurrentUser() user: AuthUser,
  ) {
    return this.projects.approveMilestone(id, milestoneId, body ?? {}, user)
  }

  @Post(':id/milestones/:milestoneId/reject')
  async rejectMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @Body() body: { reviewComment?: string | null },
    @CurrentUser() user: AuthUser,
  ) {
    return this.projects.rejectMilestone(id, milestoneId, body ?? {}, user)
  }
}
