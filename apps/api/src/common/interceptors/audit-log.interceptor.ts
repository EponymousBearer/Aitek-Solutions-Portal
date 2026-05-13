import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest()
    const { method, url, user } = request

    return next.handle().pipe(
      tap(() => {
        // TODO (Prompt 6): replace console.log with AuditLogService.log()
        console.log(`[AUDIT] ${method} ${url} — user: ${user?.id ?? 'anonymous'}`)
      }),
    )
  }
}
