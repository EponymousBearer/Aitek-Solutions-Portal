import type { AuthUser } from '@aitek/types'
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'

import { CurrentUser } from '../../common/decorators/current-user.decorator'

import { NotificationsService } from './notifications.service'

interface UpdatePreferencesBody {
  emailOnMessage?: boolean
  emailOnMilestone?: boolean
  emailOnKYC?: boolean
  emailOnAgreement?: boolean
  emailOnProject?: boolean
}

// In-app notification center for the current user.
@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  // Email-notification preferences. Declared before the parameterised routes
  // so "preferences" isn't captured as a notification id.
  @Get('preferences')
  async getPreferences(@CurrentUser() user: AuthUser) {
    return this.notifications.getPreferences(user)
  }

  @Patch('preferences')
  async updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() body: UpdatePreferencesBody,
  ) {
    return this.notifications.updatePreferences(user, body)
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notifications.list(user, {
      cursor: cursor || undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    })
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthUser) {
    return { count: await this.notifications.unreadCount(user) }
  }

  @Post('read-all')
  async markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user)
  }

  @Post(':id/read')
  async markRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.notifications.markRead(user, id)
  }
}
