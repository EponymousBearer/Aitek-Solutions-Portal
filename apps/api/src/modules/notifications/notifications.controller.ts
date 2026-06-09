import type { AuthUser } from '@aitek/types'
import { Controller, Get, Param, Post, Query } from '@nestjs/common'

import { CurrentUser } from '../../common/decorators/current-user.decorator'

import { NotificationsService } from './notifications.service'

// In-app notification center for the current user.
@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

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
