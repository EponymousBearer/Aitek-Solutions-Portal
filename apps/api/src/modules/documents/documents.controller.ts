import { DocumentAccessLevel, UserRole } from '@aitek/types'
import type { AuthUser } from '@aitek/types'
import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'

import { DocumentsService } from './documents.service'

interface PresignBody {
  fileName: string
  fileSize: number
  mimeType?: string
}

interface ConfirmBody {
  key: string
  name?: string
  fileName: string
  fileSize: number
  mimeType?: string
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

  @Post('presign')
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async presign(
    @Param('id') projectId: string,
    @Body() body: PresignBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.presignUpload(projectId, body, user)
  }

  @Post()
  @Roles(UserRole.AITEK_ADMIN, UserRole.AITEK_TEAM_MEMBER)
  async confirm(
    @Param('id') projectId: string,
    @Body() body: ConfirmBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.confirm(projectId, body, user)
  }

  @Get(':documentId/download')
  async download(
    @Param('id') projectId: string,
    @Param('documentId') documentId: string,
    @Query('disposition') disposition: string,
    @CurrentUser() user: AuthUser,
  ) {
    const d = disposition === 'inline' ? 'inline' : 'attachment'
    return this.documents.getDownloadUrl(projectId, documentId, d, user)
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
