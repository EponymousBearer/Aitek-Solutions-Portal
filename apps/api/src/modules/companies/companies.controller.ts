
import { CompanyMembershipRole, UserRole } from '@aitek/types'
import type { AuthUser, CreateCompanyInput, UpdateCompanyInput } from '@aitek/types'
import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { ClerkAuthGuard } from '../../common/guards/clerk-auth.guard'

import { CompaniesService } from './companies.service'

@Controller('companies')
@UseGuards(ClerkAuthGuard)
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  @Post()
  async createCompany(@Body() body: CreateCompanyInput, @CurrentUser() user: AuthUser) {
    return this.companiesService.createCompany(body, user)
  }

  // Admin-only routes need to be declared BEFORE the `:id` patterns or
  // Nest's router treats "pending" as a companyId. Keep them top of file.
  @Get('pending')
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async listPending(@CurrentUser() user: AuthUser) {
    return this.companiesService.listPendingApprovals(user)
  }

  @Post(':id/approve')
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.companiesService.approveCompany(id, user)
  }

  @Get('me')
  async getMyCompany(@CurrentUser() user: AuthUser) {
    return this.companiesService.getMyCompany(user)
  }

  @Put('me')
  async updateMyCompany(@Body() body: UpdateCompanyInput, @CurrentUser() user: AuthUser) {
    return this.companiesService.updateMyCompany(body, user)
  }

  @Get('me/members')
  async getMembers(@CurrentUser() user: AuthUser) {
    return this.companiesService.getMembers(user)
  }

  @Post('me/members/invite')
  async inviteMember(
    @Body() body: { email: string; role?: CompanyMembershipRole },
    @CurrentUser() user: AuthUser,
  ) {
    return this.companiesService.inviteMember(
      body.email,
      body.role ?? CompanyMembershipRole.CLIENT_USER,
      user,
    )
  }

  @Delete('me/members/:userId')
  async removeMember(@Param('userId') userId: string, @CurrentUser() user: AuthUser) {
    await this.companiesService.removeMember(userId, user)
    return { removed: true }
  }
}
