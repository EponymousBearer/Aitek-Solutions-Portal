import { Module } from '@nestjs/common'

import { ProjectsModule } from '../projects/projects.module'

import { DocumentsController } from './documents.controller'
import { DocumentsService } from './documents.service'

// Documents reuse ProjectsService.requireProjectAccess for visibility checks.
// StorageService is provided globally by StorageModule.
@Module({
  imports: [ProjectsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
