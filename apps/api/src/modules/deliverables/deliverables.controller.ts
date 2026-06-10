import { DeliverableStatus } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'

import { CurrentUser } from '../../common/decorators/current-user.decorator'

import { DeliverablesService } from './deliverables.service'

interface CreateBody {
  title: string
  description?: string | null
  url?: string | null
  status?: DeliverableStatus
}

interface UpdateBody {
  title?: string
  description?: string | null
  url?: string | null
  status?: DeliverableStatus
}

// Project-scoped deliverables. Viewing is anyone who can see the project;
// create/update/delete are gated to admin + the lead PM in the service.
@Controller('projects/:projectId/deliverables')
export class DeliverablesController {
  constructor(private deliverables: DeliverablesService) {}

  @Get()
  async list(@Param('projectId') projectId: string, @CurrentUser() user: AuthUser) {
    return this.deliverables.list(projectId, user)
  }

  @Post()
  async create(
    @Param('projectId') projectId: string,
    @Body() body: CreateBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.deliverables.create(projectId, body, user)
  }

  @Patch(':id')
  async update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: UpdateBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.deliverables.update(projectId, id, body, user)
  }

  @Delete(':id')
  async remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.deliverables.remove(projectId, id, user)
  }
}
