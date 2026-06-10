import { DocumentAccessLevel, UserRole } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'

import { DocumentsService } from './documents.service'

const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50MB

interface UploadBody {
  name?: string
  description?: string | null
  accessLevel?: DocumentAccessLevel
}

// Project-scoped documents. Visibility + access-level filtering live in the
// service. Upload/delete are AiTek-only; viewing/download is anyone who can see
// the project (clients get CLIENT_VISIBLE docs only).
@Controller('projects/:id/documents')
export class DocumentsController {
  constructor(private documents: DocumentsService) {}

  @Get()
  async list(@Param('id') projectId: string, @CurrentUser() user: AuthUser) {
    const [documents, storageConfigured] = await Promise.all([
      this.documents.list(projectId, user),
      Promise.resolve(this.documents.storageConfigured()),
    ])
    return { documents, storageConfigured }
  }

  // Multipart upload — the file streams through the API to local disk in one
  // request (no presign step). Text fields ride alongside the file in the form.
  @Post()
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  async upload(
    @Param('id') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.upload(projectId, file, body, user)
  }

  // Stream the file back, authenticated by the normal Clerk token. `disposition`
  // picks inline preview vs. attachment download. Uses @Res() to bypass the
  // global response-envelope interceptor and pipe raw bytes.
  @Get(':documentId/download')
  async download(
    @Param('id') projectId: string,
    @Param('documentId') documentId: string,
    @Query('disposition') disposition: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const d = disposition === 'inline' ? 'inline' : 'attachment'
    const { stream, fileName, mimeType, size } = await this.documents.openDownload(
      projectId,
      documentId,
      user,
    )
    const safeName = fileName.replace(/["\r\n]/g, '')
    res.set({
      'Content-Type': mimeType,
      'Content-Length': String(size),
      'Content-Disposition': `${d}; filename="${safeName}"`,
    })
    stream.on('error', () => {
      if (!res.headersSent) res.status(404).end()
      else res.end()
    })
    stream.pipe(res)
  }

  @Delete(':documentId')
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async remove(
    @Param('id') projectId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.remove(projectId, documentId, user)
  }
}
