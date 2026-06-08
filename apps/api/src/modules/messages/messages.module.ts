import { Module } from '@nestjs/common'

import { ProjectsModule } from '../projects/projects.module'

import { MessagesController } from './messages.controller'
import { MessagesGateway } from './messages.gateway'
import { MessagesService } from './messages.service'

@Module({
  imports: [ProjectsModule], // ProjectsService.requireProjectAccess
  controllers: [MessagesController],
  providers: [MessagesService, MessagesGateway],
})
export class MessagesModule {}
