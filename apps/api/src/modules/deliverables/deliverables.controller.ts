import { DeliverableStatus } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'

import { CurrentUser } from '../../common/decorators/current-user.decorator'

import { DeliverablesService } from './deliverables.service'

const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50MB
const MAX_FILES = 10

interface CreateBody {
  title: string
  description?: string | null
  url?: string | null
  status?: DeliverableStatus
}

interface UpdateBody {
  title?: string
  description?: string | null
  url?: string | null
  status?: DeliverableStatus
}

// Project-scoped deliverables. Viewing is anyone who can see the project;
// create/update/delete are gated to admin + the lead PM in the service. Create
// and update are multipart so several files can ride alongside the fields.
@Controller('projects/:projectId/deliverables')
export class DeliverablesController {
  constructor(private deliverables: DeliverablesService) {}

  @Get()
  async list(@Param('projectId') projectId: string, @CurrentUser() user: AuthUser) {
    return this.deliverables.list(projectId, user)
  }

  @Post()
  @UseInterceptors(FilesInterceptor('files', MAX_FILES, { limits: { fileSize: MAX_FILE_BYTES } }))
  async create(
    @Param('projectId') projectId: string,
    @Body() body: CreateBody,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.deliverables.create(projectId, body, files ?? [], user)
  }

  @Patch(':id')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES, { limits: { fileSize: MAX_FILE_BYTES } }))
  async update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: UpdateBody,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.deliverables.update(projectId, id, body, files ?? [], user)
  }

  // Stream an attached file. @Res() bypasses the global response envelope.
  @Get(':id/files/:fileId/download')
  async download(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const { stream, fileName, mimeType, size } = await this.deliverables.openFile(
      projectId,
      id,
      fileId,
      user,
    )
    const safeName = fileName.replace(/["\r\n]/g, '')
    res.set({
      'Content-Type': mimeType,
      'Content-Length': String(size),
      'Content-Disposition': `attachment; filename="${safeName}"`,
    })
    stream.on('error', () => {
      if (!res.headersSent) res.status(404).end()
      else res.end()
    })
    stream.pipe(res)
  }

  @Delete(':id/files/:fileId')
  async removeFile(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.deliverables.removeFile(projectId, id, fileId, user)
  }

  @Delete(':id')
  async remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.deliverables.remove(projectId, id, user)
  }
}
