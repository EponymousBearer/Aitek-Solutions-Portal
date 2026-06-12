import { Module } from '@nestjs/common'

import { NotificationsModule } from '../notifications/notifications.module'

import { KycController } from './kyc.controller'
import { KycService } from './kyc.service'

@Module({
  imports: [NotificationsModule],
  controllers: [KycController],
  providers: [KycService],
  exports: [KycService],
})
export class KycModule {}
