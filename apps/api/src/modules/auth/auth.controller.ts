import { Controller, Get, UseGuards } from '@nestjs/common'
import { ClerkAuthGuard } from '../../common/guards/clerk-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthService } from './auth.service'
import type { AuthUser } from '@aitek/types'

@Controller('auth')
@UseGuards(ClerkAuthGuard)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('me')
  async getMe(@CurrentUser() user: AuthUser) {
    return this.authService.getUserContext(user.clerkId)
  }
}
