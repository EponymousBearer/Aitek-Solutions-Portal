import { Module } from '@nestjs/common'

import { ProjectsModule } from '../projects/projects.module'

import { AgreementsController } from './agreements.controller'
import { AgreementsService } from './agreements.service'

// Agreements reuse ProjectsService.requireProjectAccess for visibility checks.
@Module({
  imports: [ProjectsModule],
  controllers: [AgreementsController],
  providers: [AgreementsService],
})
export class AgreementsModule {}
