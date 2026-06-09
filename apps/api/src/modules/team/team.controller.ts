import { AitekRole, UserRole } from '@aitek/types'
import { Controller, Get, Query } from '@nestjs/common'

import { Roles } from '../../common/decorators/roles.decorator'

import { TeamService } from './team.service'

@Controller('team')
export class TeamController {
  constructor(private team: TeamService) {}

  // Internal team directory. Admins manage it; team members (PMs) read it to
  // pick developers for their projects.
  @Get()
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async list(@Query('aitekRole') aitekRole?: AitekRole) {
    const role =
      aitekRole && Object.values(AitekRole).includes(aitekRole) ? aitekRole : undefined
    return this.team.list(role)
  }
}
