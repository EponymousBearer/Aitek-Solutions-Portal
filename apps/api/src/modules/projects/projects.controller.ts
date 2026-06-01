import { ProjectStatus, UserRole } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'

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
}
