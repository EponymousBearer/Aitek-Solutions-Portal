import { Module } from '@nestjs/common'

import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { ClerkMetadataSyncService } from './clerk-metadata-sync.service'

@Module({
  controllers: [AuthController],
  providers: [AuthService, ClerkMetadataSyncService],
  exports: [AuthService, ClerkMetadataSyncService],
})
export class AuthModule {}
