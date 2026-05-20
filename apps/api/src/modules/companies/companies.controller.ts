import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common'

import { CompanyMembershipRole } from '@aitek/types'
import type { AuthUser, CreateCompanyInput, UpdateCompanyInput } from '@aitek/types'

import { ClerkAuthGuard } from '../../common/guards/clerk-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { CompaniesService } from './companies.service'

@Controller('companies')
@UseGuards(ClerkAuthGuard)
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  @Post()
  async createCompany(@Body() body: CreateCompanyInput, @CurrentUser() user: AuthUser) {
    return this.companiesService.createCompany(body, user)
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
