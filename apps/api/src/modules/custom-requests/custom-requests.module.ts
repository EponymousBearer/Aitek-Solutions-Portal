import { Module } from '@nestjs/common'

import { CustomRequestsController } from './custom-requests.controller'
import { CustomRequestsService } from './custom-requests.service'

@Module({
  controllers: [CustomRequestsController],
  providers: [CustomRequestsService],
  exports: [CustomRequestsService],
})
export class CustomRequestsModule {}
