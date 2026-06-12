import type { AuthUser } from '@aitek/types'
import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common'

import { CurrentUser } from '../../common/decorators/current-user.decorator'

import { MessagesService } from './messages.service'

interface SendMessageBody {
  content: string
  isInternal?: boolean
  mentionedUserIds?: string[]
}

// Project-scoped messages. History + send + delete over REST; real-time
// delivery is handled by MessagesGateway. Access + internal-visibility are
// enforced in the service.
@Controller('projects/:id/messages')
export class MessagesController {
  constructor(private messages: MessagesService) {}

  @Get()
  async list(
    @Param('id') projectId: string,
    @Query('cursor') cursor: string | undefined,
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.messages.list(projectId, user, {
      cursor: cursor || undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    })
  }

  @Post()
  async send(
    @Param('id') projectId: string,
    @Body() body: SendMessageBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.messages.create(projectId, user, body)
  }

  @Delete(':messageId')
  async remove(
    @Param('id') projectId: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.messages.remove(projectId, messageId, user)
  }
}
