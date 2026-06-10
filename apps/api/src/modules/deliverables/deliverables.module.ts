import { Module } from '@nestjs/common'

import { ProjectsModule } from '../projects/projects.module'

import { DeliverablesController } from './deliverables.controller'
import { DeliverablesService } from './deliverables.service'

// Deliverables reuse ProjectsService for visibility + manage gating.
@Module({
  imports: [ProjectsModule],
  controllers: [DeliverablesController],
  providers: [DeliverablesService],
})
export class DeliverablesModule {}
