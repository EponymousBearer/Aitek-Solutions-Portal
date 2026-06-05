import type { AuthUser } from '@aitek/types'
import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common'

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest()
    return request.user
  },
)
