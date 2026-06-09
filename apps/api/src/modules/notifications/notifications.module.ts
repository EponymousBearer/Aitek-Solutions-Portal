import { Module } from '@nestjs/common'

import { EmailService } from './email.service'
import { NotificationsController } from './notifications.controller'
import { NotificationsListener } from './notifications.listener'
import { NotificationsService } from './notifications.service'

@Module({
  controllers: [NotificationsController],
  providers: [EmailService, NotificationsService, NotificationsListener],
  exports: [EmailService, NotificationsService],
})
export class NotificationsModule {}
